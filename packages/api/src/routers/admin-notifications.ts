import { prisma } from "@silonya/database";
import { z } from "zod";
import { adminProcedure, router } from "../trpc";

const CATEGORY = z.enum(["orders", "customers", "payments", "inventory", "reviews", "system"]);

/**
 * NOTIFICATION_ARCHITECTURE.md's Notification Center — bell icon, unread
 * counter, mark-as-read/archive/delete, filter by category. Scoped to the
 * current admin's own `dashboard`-channel NotificationLog rows only
 * (adminUserId = ctx.adminSession.userId) — an admin never sees another
 * admin's read/archive state, by design (createDashboardNotification writes
 * one independent row per admin for exactly this reason).
 */
export const adminNotificationsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        category: CATEGORY.optional(),
        unreadOnly: z.boolean().default(false),
        includeArchived: z.boolean().default(false),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const notifications = await prisma.notificationLog.findMany({
        where: {
          adminUserId: ctx.adminSession.userId,
          channel: "dashboard",
          ...(input.category ? { category: input.category } : {}),
          ...(input.unreadOnly ? { readAt: null } : {}),
          ...(input.includeArchived ? {} : { archivedAt: null }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = notifications.length > input.limit;
      const items = hasMore ? notifications.slice(0, -1) : notifications;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  unreadCount: adminProcedure.query(async ({ ctx }) => {
    const count = await prisma.notificationLog.count({
      where: {
        adminUserId: ctx.adminSession.userId,
        channel: "dashboard",
        readAt: null,
        archivedAt: null,
      },
    });
    return { count };
  }),

  /** Polled by the SSE stream's fallback and used to fetch anything newer than a given timestamp — see apps/admin/app/api/notifications/stream/route.ts. */
  since: adminProcedure
    .input(z.object({ after: z.string().datetime() }))
    .query(async ({ ctx, input }) => {
      return prisma.notificationLog.findMany({
        where: {
          adminUserId: ctx.adminSession.userId,
          channel: "dashboard",
          createdAt: { gt: new Date(input.after) },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
    }),

  markRead: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notificationLog.updateMany({
        where: { id: input.id, adminUserId: ctx.adminSession.userId },
        data: { readAt: new Date() },
      });
      return { success: true };
    }),

  markAllRead: adminProcedure.mutation(async ({ ctx }) => {
    await prisma.notificationLog.updateMany({
      where: { adminUserId: ctx.adminSession.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }),

  archive: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notificationLog.updateMany({
        where: { id: input.id, adminUserId: ctx.adminSession.userId },
        data: { archivedAt: new Date() },
      });
      return { success: true };
    }),

  /** "Delete" (spec) — soft, via dismissedAt + excluded from `list`'s default view, matching the rest of this codebase's never-hard-delete convention rather than actually removing the audit row. */
  dismiss: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notificationLog.updateMany({
        where: { id: input.id, adminUserId: ctx.adminSession.userId },
        data: { dismissedAt: new Date(), archivedAt: new Date() },
      });
      return { success: true };
    }),

  markClicked: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.notificationLog.updateMany({
        where: { id: input.id, adminUserId: ctx.adminSession.userId },
        data: { clickedAt: new Date(), readAt: new Date() },
      });
      return { success: true };
    }),
});
