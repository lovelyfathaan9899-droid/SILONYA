import { sendEmail } from "./send";
import { OrderConfirmationEmail } from "./templates/OrderConfirmationEmail";
import { PaymentFailedEmail } from "./templates/PaymentFailedEmail";
import type { OrderEmailData } from "./types";

export { sendEmail } from "./send";
export { OrderConfirmationEmail } from "./templates/OrderConfirmationEmail";
export { PaymentFailedEmail } from "./templates/PaymentFailedEmail";
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
