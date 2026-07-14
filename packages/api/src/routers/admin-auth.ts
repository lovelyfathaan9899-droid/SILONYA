import { createAdminSession, revokeAdminSession, verifyPassword } from "@silonya/auth";
import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../trpc";

const FAILED_LOGIN_LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Admin credential login (AUTHENTICATION.md §3). TOTP-based 2FA enrollment
 * is required "before admins can perform write actions" per that doc but
 * is not yet implemented — there are no admin write procedures in this
 * phase for it to gate, so it's deferred to the phase that adds them
 * (catalog/order management) rather than built ahead of need.
 */
export const adminAuthRouter = router({
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const genericError = new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });

      const admin = await prisma.adminUser.findUnique({
        where: { email: input.email },
        include: { role: true },
      });

      if (!admin || admin.deactivatedAt) {
        throw genericError;
      }

      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "This account is temporarily locked due to repeated failed attempts.",
        });
      }

      const passwordValid = await verifyPassword(input.password, admin.passwordHash);
      if (!passwordValid) {
        const attempts = admin.failedLoginAttempts + 1;
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil:
              attempts >= FAILED_LOGIN_LOCKOUT_THRESHOLD
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                : null,
          },
        });
        throw genericError;
      }

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });

      const tokens = await createAdminSession(admin.id, admin.role.name);

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: admin.id,
          action: "login",
          targetType: "AdminUser",
          targetId: admin.id,
        },
      });

      return {
        tokens,
        admin: { id: admin.id, email: admin.email, role: admin.role.name },
      };
    }),

  session: adminProcedure.query(async ({ ctx }) => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: ctx.adminSession.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!admin) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return { ...admin, role: ctx.adminSession.role };
  }),

  logout: adminProcedure.mutation(async ({ ctx }) => {
    await revokeAdminSession(ctx.adminSession.sessionId);
    return { success: true };
  }),
});
