import { signOrderAccessToken } from "@silonya/auth";
import {
  getStripeClient,
  markOrderPaid,
  markOrderPaymentFailed,
  syncRefundFromWebhook,
  toOrderEmailData,
} from "@silonya/api";
import { prisma } from "@silonya/database";
import { sendOrderConfirmationEmail, sendPaymentFailedEmail } from "@silonya/emails";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { SITE_URL } from "@/lib/site-config";

/**
 * PAYMENT_ARCHITECTURE.md §3 — signature-verified, idempotent via
 * ProcessedWebhookEvent, order status transitions from here (never from the
 * client redirect). No BullMQ queue exists yet (Phase 6 deviation, see
 * PAYMENT_ARCHITECTURE.md's note), so event processing happens synchronously
 * in the request instead of being enqueued — still fast, since it's one
 * transaction plus a best-effort email send.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await prisma.processedWebhookEvent.create({
      data: { provider: "stripe", eventId: event.id },
    });
  } catch {
    // Unique constraint on eventId — already processed, no-op (idempotency).
    return NextResponse.json({ received: true });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.id;
        const order = await markOrderPaid(orderId, paymentIntentId);
        await sendConfirmationEmail(order);
      }
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await markOrderPaymentFailed(orderId);
        await sendFailureEmail(order);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;
      if (orderId) {
        const order = await markOrderPaymentFailed(orderId);
        await sendFailureEmail(order);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      const latestRefund = charge.refunds?.data.at(-1);
      if (paymentIntentId && latestRefund) {
        await syncRefundFromWebhook(paymentIntentId, latestRefund.id, latestRefund.amount);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

type FulfilledOrder = Awaited<ReturnType<typeof markOrderPaid>>;

async function sendConfirmationEmail(order: FulfilledOrder): Promise<void> {
  if (!order.guestEmail) return;
  const token = await signOrderAccessToken({ orderId: order.id, email: order.guestEmail });
  const emailData = toOrderEmailData(order, `${SITE_URL}/order/confirmation?token=${token}`);
  if (!emailData) return;
  await sendOrderConfirmationEmail(emailData);
}

async function sendFailureEmail(order: FulfilledOrder): Promise<void> {
  if (!order.guestEmail) return;
  await sendPaymentFailedEmail({
    guestEmail: order.guestEmail,
    orderNumber: order.orderNumber,
    retryUrl: `${SITE_URL}/cart`,
  });
}
