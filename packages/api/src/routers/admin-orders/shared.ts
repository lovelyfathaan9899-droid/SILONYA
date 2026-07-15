import type { OrderStatus } from "@silonya/database";
import { getStripeClient } from "../../lib/stripe";

/** ORDER_MANAGEMENT.md §2 — the only permitted status transitions; every write is checked against this graph, never assumed valid. */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: ["refunded"],
  refunded: [],
  partially_refunded: [],
};

export interface StripeRefundResult {
  stripeRefundId: string;
}

/**
 * Issues a Stripe refund against the order's PaymentIntent. Kept outside any
 * DB transaction — same reasoning as checkout.createIntent's Stripe call
 * (PAYMENT_ARCHITECTURE.md §4's idempotency key still applies, derived from
 * order + amount + a minute-truncated timestamp so a genuine second partial
 * refund a minute later isn't blocked, but an accidental double-click is).
 */
export async function issueStripeRefund(
  stripePaymentIntentId: string,
  amount: number,
  orderId: string,
): Promise<StripeRefundResult> {
  const stripe = getStripeClient();
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const refund = await stripe.refunds.create(
    { payment_intent: stripePaymentIntentId, amount, metadata: { orderId } },
    { idempotencyKey: `refund_${orderId}_${String(amount)}_${String(minuteBucket)}` },
  );
  return { stripeRefundId: refund.id };
}
