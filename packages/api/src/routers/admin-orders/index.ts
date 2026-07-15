import { signOrderAccessToken } from "@silonya/auth";
import { prisma } from "@silonya/database";
import {
  sendCancelledEmail,
  sendDeliveredEmail,
  sendOrderConfirmationEmail,
  sendRefundIssuedEmail,
  sendShippedEmail,
} from "@silonya/emails";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { toOrderEmailData } from "../../lib/order-email-mapper";
import { siteUrl } from "../../lib/site-url";
import { getDefaultWarehouseId } from "../admin-catalog/shared";
import { restockInventory } from "../../services/inventory";
import { issueStripeRefund, VALID_TRANSITIONS } from "./shared";

const ordersRead = requirePermission("orders:read");
const ordersWrite = requirePermission("orders:write");
const refundsWrite = requirePermission("refunds:write");

const ORDER_STATUS = z.enum([
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
  "partially_refunded",
]);

const orderDetailInclude = {
  items: true,
  shippingAddress: true,
  billingAddress: true,
  payment: { include: { refunds: true } },
  statusEvents: {
    orderBy: { createdAt: "desc" as const },
    include: { adminUser: { select: { email: true } } },
  },
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { adminUser: { select: { email: true } } },
  },
  discount: true,
};

async function orderTrackingUrl(orderId: string, guestEmail: string): Promise<string> {
  const token = await signOrderAccessToken({ orderId, email: guestEmail });
  return `${siteUrl()}/order/confirmation?token=${token}`;
}

export const adminOrdersRouter = {
  /** ADMIN_PANEL.md §4.2 — cursor-paginated, filterable by status/date range/search (order number, customer email). */
  list: ordersRead
    .input(
      z.object({
        search: z.string().trim().min(1).optional(),
        status: ORDER_STATUS.optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const orders = await prisma.order.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.search
            ? {
                OR: [
                  { orderNumber: { contains: input.search, mode: "insensitive" as const } },
                  { guestEmail: { contains: input.search, mode: "insensitive" as const } },
                ],
              }
            : {}),
          ...(input.dateFrom || input.dateTo
            ? {
                createdAt: {
                  ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
                  ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { items: true },
      });

      const hasMore = orders.length > input.limit;
      const items = hasMore ? orders.slice(0, -1) : orders;

      return {
        items: items.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          guestEmail: order.guestEmail,
          status: order.status,
          grandTotal: order.grandTotal,
          currency: order.currency,
          itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: order.createdAt,
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  getById: ordersRead.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const order = await prisma.order.findUnique({
      where: { id: input.id },
      include: orderDetailInclude,
    });
    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    }
    return order;
  }),

  /**
   * Fulfillment status transitions (ADMIN_PANEL.md §4.2, ORDER_MANAGEMENT.md
   * §2). Validated strictly against VALID_TRANSITIONS — every transition is
   * written to OrderStatusEvent + AuditLogEntry regardless of outcome.
   * Cancelling a `paid`/`processing` order issues an automatic full refund
   * (ORDER_MANAGEMENT.md §6); `restock` lets the admin decide whether the
   * stock actually comes back (damaged-goods cancellations shouldn't
   * restock, per §7's return-handling precedent).
   */
  updateStatus: ordersWrite
    .input(
      z.object({
        id: z.string().uuid(),
        status: ORDER_STATUS,
        trackingNumber: z.string().trim().min(1).optional(),
        carrier: z.string().trim().min(1).optional(),
        note: z.string().trim().min(1).optional(),
        restock: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.id },
        include: { items: true, payment: { include: { refunds: true } } },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }

      const allowed = VALID_TRANSITIONS[order.status];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot move an order from "${order.status}" to "${input.status}".`,
        });
      }

      if (input.status === "shipped" && !input.trackingNumber) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A tracking number is required to mark an order as shipped.",
        });
      }

      const isCancellingPaidOrder =
        input.status === "cancelled" && (order.status === "paid" || order.status === "processing");

      let refundedAmount: number | null = null;
      if (isCancellingPaidOrder && order.payment) {
        const alreadyRefunded = order.payment.refunds.reduce((sum, r) => sum + r.amount, 0);
        const remaining = order.payment.amount - alreadyRefunded;
        if (remaining > 0) {
          const { stripeRefundId } = await issueStripeRefund(
            order.payment.stripePaymentIntentId,
            remaining,
            order.id,
          );
          await prisma.refund.create({
            data: {
              paymentId: order.payment.id,
              stripeRefundId,
              amount: remaining,
              reason: "Order cancelled",
            },
          });
          await prisma.payment.update({
            where: { id: order.payment.id },
            data: { status: "refunded" },
          });
          refundedAmount = remaining;
        }
      }

      const warehouseId = await getDefaultWarehouseId();

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: input.id },
          data: {
            status: input.status,
            ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
            ...(input.carrier ? { carrier: input.carrier } : {}),
          },
        });
        await tx.orderStatusEvent.create({
          data: {
            orderId: input.id,
            status: input.status,
            triggeredBy: "admin",
            adminUserId: ctx.adminSession.userId,
            ...(input.note ? { note: input.note } : {}),
          },
        });
        await tx.auditLogEntry.create({
          data: {
            adminUserId: ctx.adminSession.userId,
            action: "update_order_status",
            targetType: "Order",
            targetId: input.id,
            metadata: { from: order.status, to: input.status, refundedAmount },
          },
        });

        if (input.status === "cancelled" && input.restock) {
          await restockInventory(tx, order.items, warehouseId);
        }
      });

      if (order.guestEmail) {
        const trackingUrl = await orderTrackingUrl(order.id, order.guestEmail);
        if (input.status === "shipped" && input.trackingNumber) {
          await sendShippedEmail({
            guestEmail: order.guestEmail,
            orderNumber: order.orderNumber,
            trackingNumber: input.trackingNumber,
            carrier: input.carrier ?? null,
            orderTrackingUrl: trackingUrl,
          });
        } else if (input.status === "delivered") {
          await sendDeliveredEmail({
            guestEmail: order.guestEmail,
            orderNumber: order.orderNumber,
            orderTrackingUrl: trackingUrl,
          });
        } else if (input.status === "cancelled") {
          await sendCancelledEmail({
            guestEmail: order.guestEmail,
            orderNumber: order.orderNumber,
            refunded: refundedAmount !== null,
            orderTrackingUrl: trackingUrl,
          });
        }
      }

      return prisma.order.findUniqueOrThrow({
        where: { id: input.id },
        include: orderDetailInclude,
      });
    }),

  /** Internal, staff-only notes (ADMIN_PANEL.md §4.2) — append-only, never customer-visible. */
  addNote: ordersWrite
    .input(z.object({ orderId: z.string().uuid(), body: z.string().trim().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await prisma.orderNote.create({
        data: { orderId: input.orderId, adminUserId: ctx.adminSession.userId, body: input.body },
      });
      return prisma.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: orderDetailInclude,
      });
    }),

  /**
   * Standalone full/partial refund (PAYMENT_ARCHITECTURE.md §5) —
   * independent of cancellation, for goodwill/dispute/defect cases. Amount
   * is capped at what's left of the original charge; Order.status reflects
   * full vs. partial.
   */
  issueRefund: refundsWrite
    .input(
      z.object({
        orderId: z.string().uuid(),
        amount: z.number().int().min(1),
        reason: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: { payment: { include: { refunds: true } } },
      });
      if (!order?.payment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This order has no payment to refund.",
        });
      }
      const payment = order.payment;

      const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
      const remaining = payment.amount - alreadyRefunded;
      if (input.amount > remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Refund amount exceeds what's left to refund (${String(remaining)} minor units).`,
        });
      }

      const { stripeRefundId } = await issueStripeRefund(
        payment.stripePaymentIntentId,
        input.amount,
        order.id,
      );

      const isFullyRefunded = alreadyRefunded + input.amount >= payment.amount;

      await prisma.$transaction(async (tx) => {
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            stripeRefundId,
            amount: input.amount,
            reason: input.reason,
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: isFullyRefunded ? "refunded" : "partially_refunded" },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: isFullyRefunded ? "refunded" : "partially_refunded" },
        });
        await tx.auditLogEntry.create({
          data: {
            adminUserId: ctx.adminSession.userId,
            action: "issue_refund",
            targetType: "Order",
            targetId: order.id,
            metadata: { amount: input.amount, reason: input.reason, stripeRefundId },
          },
        });
      });

      if (order.guestEmail) {
        await sendRefundIssuedEmail({
          guestEmail: order.guestEmail,
          orderNumber: order.orderNumber,
          amount: input.amount,
          currency: order.currency,
          orderTrackingUrl: await orderTrackingUrl(order.id, order.guestEmail),
        });
      }

      return prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderDetailInclude,
      });
    }),

  resendConfirmationEmail: ordersWrite
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: { items: true, shippingAddress: true },
      });
      if (!order?.guestEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This order has no guest email on file.",
        });
      }

      const trackingUrl = await orderTrackingUrl(order.id, order.guestEmail);
      const emailData = toOrderEmailData(order, trackingUrl);
      if (emailData) {
        await sendOrderConfirmationEmail(emailData);
      }

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "resend_confirmation_email",
          targetType: "Order",
          targetId: order.id,
        },
      });

      return { success: true };
    }),
};
