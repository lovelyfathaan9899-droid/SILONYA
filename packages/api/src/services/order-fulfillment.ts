import { prisma } from "@silonya/database";
import { getDefaultWarehouseId } from "../routers/admin-catalog/shared";
import { finalizeReservation, releaseReservation } from "./inventory";

const orderWithDetails = {
  items: true,
  shippingAddress: true,
  billingAddress: true,
} as const;

const RESERVATION_EXPIRY_MINUTES = 15;

/**
 * Reservation-expiry sweep — PAYMENT_ARCHITECTURE.md §7's "reservation
 * expires via the scheduled sweep job (~15 min)". DEPLOYMENT.md §1
 * specifies this as a BullMQ worker on a separate always-on process
 * (Railway/Fly.io); that infrastructure isn't provisioned in this
 * environment (same documented gap as Redis/BullMQ elsewhere), and nothing
 * else called this logic either — every abandoned checkout permanently
 * held its reserved stock (quantity_reserved never released), degrading
 * sellable inventory (quantityOnHand - quantityReserved) toward zero over
 * time even though nothing physically sold. Wired to Vercel Cron instead
 * (apps/web/app/api/cron/release-expired-reservations/route.ts,
 * apps/web/vercel.json) as a pragmatic substitute that needs no new
 * infrastructure — same outcome (stale reservations released on a
 * schedule), not literally the target BullMQ-worker architecture.
 *
 * Same idempotency shape as markOrderPaid/markOrderPaymentFailed: each
 * order's release happens inside its own transaction, guarded by
 * `status !== "pending_payment"`, so a webhook that pays the order in the
 * same window as a sweep run can't race this into wrongly cancelling a
 * just-paid order — whichever transaction commits first wins, the other
 * sees the flipped status and no-ops.
 */
export async function releaseExpiredReservations(): Promise<{ releasedCount: number }> {
  const cutoff = new Date(Date.now() - RESERVATION_EXPIRY_MINUTES * 60 * 1000);
  const staleOrders = await prisma.order.findMany({
    where: { status: "pending_payment", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (staleOrders.length === 0) {
    return { releasedCount: 0 };
  }

  const warehouseId = await getDefaultWarehouseId();
  let releasedCount = 0;

  for (const { id: orderId } of staleOrders) {
    const released = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (order?.status !== "pending_payment") {
        return false;
      }

      await releaseReservation(tx, order.items, warehouseId);
      await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
      await tx.orderStatusEvent.create({
        data: {
          orderId,
          status: "cancelled",
          triggeredBy: "system",
          note: `Checkout abandoned — reservation released after ${String(RESERVATION_EXPIRY_MINUTES)} minutes with no payment.`,
        },
      });
      return true;
    });
    if (released) releasedCount++;
  }

  return { releasedCount };
}

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

/**
 * Called on `charge.dispute.created` — PAYMENT_ARCHITECTURE.md §7's "flags
 * the order and alerts the admin team." No admin-alert email channel exists
 * yet (Resend isn't configured, and there's no admin-facing alert
 * template — building one is a real feature, not a bug fix), so this
 * records a visible audit-trail entry on the order (surfaced in the admin
 * order detail view alongside every other status event, per
 * OrderStatusEvent's existing append-only design — no schema change
 * needed, since a dispute doesn't change `Order.status` itself) and logs
 * loudly for whatever monitoring is watching server logs. The minimum
 * viable signal given current infrastructure, not a substitute for real
 * alerting once Sentry/PostHog are provisioned.
 */
export async function flagOrderDisputed(
  stripePaymentIntentId: string,
  disputeId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId } });
  if (!payment) {
    console.error(
      `[stripe webhook] charge.dispute.created for unknown payment intent ${stripePaymentIntentId} (dispute ${disputeId})`,
    );
    return;
  }
  const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
  if (!order) return;

  await prisma.orderStatusEvent.create({
    data: {
      orderId: order.id,
      status: order.status,
      triggeredBy: "webhook",
      note: `Chargeback opened (Stripe dispute ${disputeId}, reason: ${reason}, amount: ${String(amount)}). Respond via the Stripe dashboard.`,
    },
  });
  console.error(
    `[stripe webhook] CHARGEBACK: order ${order.orderNumber} (${order.id}) disputed — Stripe dispute ${disputeId}, reason ${reason}, amount ${String(amount)}.`,
  );
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
