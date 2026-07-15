import {
  checkPasswordStrength,
  consumeVerificationToken,
  createCustomerSession,
  hashPassword,
  issueVerificationToken,
  revokeAllCustomerSessions,
  revokeCustomerSession,
  verifyPassword,
} from "@silonya/auth";
import { prisma } from "@silonya/database";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@silonya/emails";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { siteUrl } from "../lib/site-url";
import { customerProcedure, publicProcedure, router } from "../trpc";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8);

async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await issueVerificationToken(userId, "email_verification");
  await sendEmailVerificationEmail({
    to: email,
    verifyUrl: `${siteUrl()}/verify-email?token=${token}`,
  }).catch((err: unknown) => {
    console.error("[customerAuth] failed to send verification email:", err);
  });
}

/**
 * Customer-facing authentication (AUTHENTICATION.md §2). Cookie-writing is
 * done by the caller (apps/web Server Actions, mirroring apps/admin's
 * app/login/actions.ts) — these procedures only issue/revoke tokens.
 */
export const customerAuthRouter = router({
  /**
   * Registration doesn't block checkout (AUTHENTICATION.md §2.1) — a
   * password is required here regardless, since this app has no separate
   * "guest to account" upgrade flow yet, only retroactive order linking by
   * email once an account is created.
   */
  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        firstName: z.string().trim().min(1).optional(),
        lastName: z.string().trim().min(1).optional(),
        marketingOptIn: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const strength = await checkPasswordStrength(
        input.password,
        [input.email, input.firstName ?? "", input.lastName ?? ""].filter(Boolean),
      );
      if (!strength.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: strength.reason });
      }

      const passwordHash = await hashPassword(input.password);

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            marketingOptIn: input.marketingOptIn,
          },
        });

        // Retroactively link prior guest orders placed under this email
        // (ORDER_MANAGEMENT.md — guest checkout stays first-class; this is
        // the one place a guest order becomes visible in account history).
        await tx.order.updateMany({
          where: { userId: null, guestEmail: { equals: input.email, mode: "insensitive" } },
          data: { userId: created.id },
        });

        return created;
      });

      const tokens = await createCustomerSession(user.id);

      await sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        accountUrl: `${siteUrl()}/account`,
      }).catch((err: unknown) => {
        console.error("[customerAuth] failed to send welcome email:", err);
      });
      await sendVerificationEmail(user.id, user.email);

      return {
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    }),

  login: publicProcedure
    .input(z.object({ email: emailSchema, password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const genericError = new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });

      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user || user.deletedAt || !user.passwordHash) {
        throw genericError;
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw genericError;
      }

      const tokens = await createCustomerSession(user.id);

      return {
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    }),

  session: customerProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.customerSession.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        marketingOptIn: true,
      },
    });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return user;
  }),

  logout: customerProcedure.mutation(async ({ ctx }) => {
    await revokeCustomerSession(ctx.customerSession.sessionId);
    return { success: true };
  }),

  changePassword: customerProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: ctx.customerSession.userId },
      });
      if (!user.passwordHash || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
      }

      const strength = await checkPasswordStrength(input.newPassword, [user.email]);
      if (!strength.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: strength.reason });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      await revokeAllCustomerSessions(user.id);

      const tokens = await createCustomerSession(user.id);
      return { tokens };
    }),

  /** Always returns success regardless of whether the email exists (AUTHENTICATION.md §2.4 — never leak account existence). */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (user && !user.deletedAt) {
        const token = await issueVerificationToken(user.id, "password_reset");
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl: `${siteUrl()}/reset-password?token=${token}`,
        }).catch((err: unknown) => {
          console.error("[customerAuth] failed to send password reset email:", err);
        });
      }
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string().min(1), newPassword: passwordSchema }))
    .mutation(async ({ input }) => {
      const userId = await consumeVerificationToken(input.token, "password_reset");
      if (!userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This link is invalid or has expired.",
        });
      }

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const strength = await checkPasswordStrength(input.newPassword, [user.email]);
      if (!strength.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: strength.reason });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
      // AUTHENTICATION.md §2.4 — password reset revokes all other sessions.
      await revokeAllCustomerSessions(userId);

      return { success: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const userId = await consumeVerificationToken(input.token, "email_verification");
      if (!userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This link is invalid or has expired.",
        });
      }
      await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      return { success: true };
    }),

  resendVerification: customerProcedure.mutation(async ({ ctx }) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.customerSession.userId } });
    if (user.emailVerifiedAt) {
      return { success: true, alreadyVerified: true };
    }
    await sendVerificationEmail(user.id, user.email);
    return { success: true, alreadyVerified: false };
  }),
});
