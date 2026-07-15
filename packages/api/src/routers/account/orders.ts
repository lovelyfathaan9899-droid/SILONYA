import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { customerProcedure, router } from "../../trpc";

/** CUSTOMER ACCOUNT SYSTEM — customer order history, order details/tracking, scoped to the logged-in user's own orders (never another customer's). */
export const ordersRouter = router({
  list: customerProcedure
    .input(
      z.object({
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orders = await prisma.order.findMany({
        where: { userId: ctx.customerSession.userId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { items: true },
      });

      const hasMore = orders.length > input.limit;
      const items = (hasMore ? orders.slice(0, -1) : orders).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal,
        currency: order.currency,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt,
      }));

      return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  detail: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.id },
        include: {
          items: true,
          shippingAddress: true,
          billingAddress: true,
          payment: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
          discount: true,
        },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.userId !== ctx.customerSession.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      return order;
    }),
});
