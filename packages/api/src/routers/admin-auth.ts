import {
  createAdminSession,
  revokeAdminSession,
  rotateAdminSession,
  verifyPassword,
} from "@silonya/auth";
import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { checkRateLimit } from "../lib/rate-limit";
import { adminProcedure, publicProcedure, router } from "../trpc";

const FAILED_LOGIN_LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
// Per-account lockout (below) throttles repeated guesses against ONE admin
// email; it does nothing against an attacker enumerating MANY different
// admin emails, since each gets a fresh lockout counter. Admin accounts are
// few and high-value, so a single shared bucket across all admin logins
// (not per-email/IP — this app doesn't reliably expose a client IP to the
// resolver, same reasoning as customer-auth.ts's login rate limit) is an
// acceptable trade for that coverage: legitimate concurrent admin typos
// are rare enough not to hit this in practice.
const ADMIN_LOGIN_GLOBAL_LIMIT = 30;
const ADMIN_LOGIN_GLOBAL_WINDOW_MS = 15 * 60 * 1000;

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
      const rateLimitResult = checkRateLimit(
        "admin-login",
        ADMIN_LOGIN_GLOBAL_LIMIT,
        ADMIN_LOGIN_GLOBAL_WINDOW_MS,
      );
      if (!rateLimitResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts. Please try again in a few minutes.",
        });
      }

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

  /** Same "silent refresh before expiry" reasoning as customerAuth.refresh — see that procedure's doc comment. */
  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const tokens = await rotateAdminSession(input.refreshToken);
      if (!tokens) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Session expired. Please sign in again.",
        });
      }
      return { tokens };
    }),
});
