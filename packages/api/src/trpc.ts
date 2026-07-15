import { prisma } from "@silonya/database";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires a valid admin session. Does not check a specific permission — see requirePermission. */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.adminSession) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin session required." });
  }
  return next({ ctx: { ...ctx, adminSession: ctx.adminSession } });
});

/** Requires a valid customer session (AUTHENTICATION.md §2). */
export const customerProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.customerSession) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return next({ ctx: { ...ctx, customerSession: ctx.customerSession } });
});

/**
 * RBAC enforcement (AUTHENTICATION.md §4) — every write-affecting admin
 * procedure declares the exact permission it requires; this is the only
 * place that check happens, never left to UI-level hiding.
 */
export function requirePermission(permissionKey: string) {
  return adminProcedure.use(async ({ ctx, next }) => {
    const grant = await prisma.rolePermission.findFirst({
      where: {
        role: { name: ctx.adminSession.role },
        permission: { key: permissionKey },
      },
    });
    if (!grant) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permissionKey}`,
      });
    }
    return next({ ctx });
  });
}
