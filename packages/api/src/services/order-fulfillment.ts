import { prisma } from "@silonya/database";
import { getDefaultWarehouseId } from "../routers/admin-catalog/shared";
import { finalizeReservation, releaseReservation } from "./inventory";

const orderWithDetails = {
  items: true,
  shippingAddress: true,
  billingAddress: true,
} as const;

/**
 * Called from the Stripe webhook handler (apps/web) on
 * `checkout.session.completed` — PAYMENT_ARCHITECTURE.md §2's "order status
 * becomes paid from the webhook, not the client redirect." Idempotent: if
 * the order isn't still `pending_payment` (a redelivered webhook, or one
 * that arrived after another already processed it), this is a no-op that
 * returns the order as-is — the ProcessedWebhookEvent table is the primary
 * idempotency guard, this is the second layer.
 */
export async function markOrderPaid(orderId: string, stripePaymentIntentId: string) {
  const warehouseId = await getDefaultWarehouseId();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderWithDetails });
    if (!order) {
      throw new Error(`markOrderPaid: order ${orderId} not found.`);
    }
    if (order.status !== "pending_payment") {
      return order;
    }

    await finalizeReservation(tx, order.items, warehouseId);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "paid", placedAt: new Date() },
      include: orderWithDetails,
    });
    await tx.orderStatusEvent.create({
      data: { orderId, status: "paid", triggeredBy: "webhook" },
    });
    await tx.payment.update({
      where: { orderId },
      data: { status: "succeeded", stripePaymentIntentId },
    });

    return updated;
  });
}

/**
 * Called on `charge.refunded` — PAYMENT_ARCHITECTURE.md §5's "refund status
 * is synced back via the webhook, not assumed successful the moment the
 * admin clicks the button." In practice, admin.orders.issueRefund already
 * records the Refund row synchronously after Stripe accepts the request
 * (test-mode refunds settle near-instantly), so this is usually a no-op —
 * it only creates a new Refund row for a `stripeRefundId` it hasn't seen
 * yet (a genuinely async refund, or one issued directly in the Stripe
 * dashboard outside the admin panel).
 */
export async function syncRefundFromWebhook(
  stripePaymentIntentId: string,
  stripeRefundId: string,
  amount: number,
): Promise<void> {
  const existing = await prisma.refund.findUnique({ where: { stripeRefundId } });
  if (existing) return;

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    include: { refunds: true },
  });
  if (!payment) return;

  const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
  const isFullyRefunded = alreadyRefunded + amount >= payment.amount;

  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: { paymentId: payment.id, stripeRefundId, amount, reason: "Synced from Stripe" },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: isFullyRefunded ? "refunded" : "partially_refunded" },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: isFullyRefunded ? "refunded" : "partially_refunded" },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: payment.orderId,
        status: isFullyRefunded ? "refunded" : "partially_refunded",
        triggeredBy: "webhook",
      },
    });
  });
}

/** Called on `payment_intent.payment_failed` / `checkout.session.async_payment_failed`. Same idempotency shape as markOrderPaid. */
export async function markOrderPaymentFailed(orderId: string) {
  const warehouseId = await getDefaultWarehouseId();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderWithDetails });
    if (!order) {
      throw new Error(`markOrderPaymentFailed: order ${orderId} not found.`);
    }
    if (order.status !== "pending_payment") {
      return order;
    }

    await releaseReservation(tx, order.items, warehouseId);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "payment_failed" },
      include: orderWithDetails,
    });
    await tx.orderStatusEvent.create({
      data: { orderId, status: "payment_failed", triggeredBy: "webhook" },
    });
    await tx.payment.update({ where: { orderId }, data: { status: "failed" } });

    return updated;
  });
}
