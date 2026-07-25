import { signOrderAccessToken } from "@silonya/auth";
import { prisma } from "@silonya/database";
import {
  sendCancelledEmail,
  sendDeliveredEmail,
  sendRefundIssuedEmail,
  sendShippedEmail,
} from "@silonya/emails";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { siteUrl } from "../../lib/site-url";
import { getDefaultWarehouseId } from "../admin-catalog/shared";
import { restockInventory } from "../../services/inventory";
import { attemptSend } from "../../services/whatsapp/outbox";
import {
  sendDeliveredWhatsApp,
  sendOrderConfirmationWhatsApp,
  sendOrderStatusWhatsApp,
  sendShippedWhatsApp,
} from "../../services/whatsapp/order-notifications";
import { issueStripeRefund, VALID_TRANSITIONS } from "./shared";

const ordersRead = requirePermission("orders:read");
const ordersWrite = requirePermission("orders:write");
const refundsWrite = requirePermission("refunds:write");

const ORDER_STATUS = z.enum([
  "pending_payment",
  "payment_failed",
  "paid",
  "pending_confirmation",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
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
        include: {
          items: true,
          payment: { include: { refunds: true } },
          shippingAddress: true,
        },
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

      // ORDER STATUS NOTIFICATIONS spec — every admin-driven status change
      // notifies the customer over WhatsApp too, alongside the email above.
      // Best-effort: a failed/unconfigured send never fails the status
      // update itself (the WhatsApp history panel is where a failure shows
      // up, not this mutation's response).
      const orderForWhatsApp = { ...order, shippingMethod: order.shippingMethod };
      try {
        if (input.status === "shipped" && input.trackingNumber) {
          await sendShippedWhatsApp(orderForWhatsApp, {
            trackingNumber: input.trackingNumber,
            carrier: input.carrier ?? "Courier",
            trackingUrl: null,
          });
        } else if (input.status === "delivered") {
          await sendDeliveredWhatsApp(orderForWhatsApp);
        } else {
          await sendOrderStatusWhatsApp(
            orderForWhatsApp,
            input.status,
            input.status === "cancelled" ? (input.note ?? "Cancelled by admin.") : undefined,
          );
        }
      } catch (err) {
        console.error("[admin-orders] failed to send status-change WhatsApp message:", err);
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

  /**
   * ADMIN PANEL spec — replaces the old "Resend Confirmation Email" action.
   * Dispatches whichever WhatsApp template matches the order's *current*
   * status (pending_confirmation → the interactive order-confirmation
   * message with Confirm/Cancel/Help buttons; shipped → the tracking
   * message using whatever tracking info is already on the order;
   * everything else → the matching lifecycle-status template). Always
   * creates a new WhatsAppMessage row rather than touching an old one —
   * "Send WhatsApp" is "send it now," not "edit history."
   */
  sendWhatsApp: ordersWrite
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: { items: true, shippingAddress: true },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (!order.shippingAddress.whatsappPhone && !order.shippingAddress.phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This order has no phone number on file.",
        });
      }

      if (order.status === "pending_confirmation") {
        await sendOrderConfirmationWhatsApp(order);
      } else if (order.status === "shipped") {
        await sendShippedWhatsApp(order, {
          trackingNumber: order.trackingNumber ?? "Not available",
          carrier: order.carrier ?? "Courier",
          trackingUrl: null,
        });
      } else if (order.status === "delivered") {
        await sendDeliveredWhatsApp(order);
      } else {
        await sendOrderStatusWhatsApp(order, order.status);
      }

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "send_whatsapp",
          targetType: "Order",
          targetId: order.id,
          metadata: { status: order.status },
        },
      });

      return { success: true };
    }),

  /** Re-attempts one specific WhatsAppMessage row (the "Retry" action next to a failed send in the order's WhatsApp history) — resends the exact payload already stored rather than re-deriving it, so a retry reflects what was actually queued at send time even if order data has since changed. */
  resendWhatsAppMessage: ordersWrite
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const message = await prisma.whatsAppMessage.findUnique({ where: { id: input.messageId } });
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found." });
      }

      const sent = await attemptSend(message.id, message.payload as never);

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "resend_whatsapp_message",
          targetType: "WhatsAppMessage",
          targetId: message.id,
          metadata: { orderId: message.orderId, sent },
        },
      });

      return { success: sent };
    }),

  /** WhatsApp Timeline / "View WhatsApp History" (ADMIN_PANEL spec) — every message sent for this order plus every webhook event received for it (button taps, delivery/read receipts), newest first. */
  getWhatsAppHistory: ordersRead
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [messages, events] = await Promise.all([
        prisma.whatsAppMessage.findMany({
          where: { orderId: input.orderId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.whatsAppEvent.findMany({
          where: { orderId: input.orderId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return { messages, events };
    }),
};
