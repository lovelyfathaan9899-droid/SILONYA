import { sendEmail } from "./send";
import { OrderConfirmationEmail } from "./templates/OrderConfirmationEmail";
import { PaymentFailedEmail } from "./templates/PaymentFailedEmail";
import {
  CancelledEmail,
  DeliveredEmail,
  RefundIssuedEmail,
  ShippedEmail,
} from "./templates/ShippedEmail";
import type { OrderEmailData } from "./types";

export { sendEmail } from "./send";
export { OrderConfirmationEmail } from "./templates/OrderConfirmationEmail";
export { PaymentFailedEmail } from "./templates/PaymentFailedEmail";
export {
  ShippedEmail,
  DeliveredEmail,
  CancelledEmail,
  RefundIssuedEmail,
} from "./templates/ShippedEmail";
export type { OrderEmailData } from "./types";

export async function sendOrderConfirmationEmail(order: OrderEmailData): Promise<void> {
  await sendEmail({
    to: order.guestEmail,
    subject: `Order confirmed — ${order.orderNumber}`,
    react: OrderConfirmationEmail({ order }),
  });
}

export async function sendPaymentFailedEmail(input: {
  guestEmail: string;
  orderNumber: string;
  retryUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.guestEmail,
    subject: `Payment issue — order ${input.orderNumber}`,
    react: PaymentFailedEmail({ orderNumber: input.orderNumber, retryUrl: input.retryUrl }),
  });
}

export async function sendShippedEmail(input: {
  guestEmail: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string | null;
  orderTrackingUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.guestEmail,
    subject: `Your order has shipped — ${input.orderNumber}`,
    react: ShippedEmail(input),
  });
}

export async function sendDeliveredEmail(input: {
  guestEmail: string;
  orderNumber: string;
  orderTrackingUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.guestEmail,
    subject: `Your order has been delivered — ${input.orderNumber}`,
    react: DeliveredEmail(input),
  });
}

export async function sendCancelledEmail(input: {
  guestEmail: string;
  orderNumber: string;
  refunded: boolean;
  orderTrackingUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.guestEmail,
    subject: `Order cancelled — ${input.orderNumber}`,
    react: CancelledEmail(input),
  });
}

export async function sendRefundIssuedEmail(input: {
  guestEmail: string;
  orderNumber: string;
  amount: number;
  currency: string;
  orderTrackingUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.guestEmail,
    subject: `Refund issued — ${input.orderNumber}`,
    react: RefundIssuedEmail(input),
  });
}
