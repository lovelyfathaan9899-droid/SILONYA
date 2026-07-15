import { sendEmail } from "./send";
import {
  CouponEmail,
  EmailVerificationEmail,
  PasswordResetEmail,
  ReviewReminderEmail,
  WelcomeEmail,
  WishlistReminderEmail,
} from "./templates/AccountEmails";
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
export {
  WelcomeEmail,
  PasswordResetEmail,
  EmailVerificationEmail,
  ReviewReminderEmail,
  WishlistReminderEmail,
  CouponEmail,
} from "./templates/AccountEmails";
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

export async function sendWelcomeEmail(input: {
  to: string;
  firstName: string | null;
  accountUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Welcome to SILONYA",
    react: WelcomeEmail({ firstName: input.firstName, accountUrl: input.accountUrl }),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Reset your SILONYA password",
    react: PasswordResetEmail({ resetUrl: input.resetUrl }),
  });
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  verifyUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Verify your email address",
    react: EmailVerificationEmail({ verifyUrl: input.verifyUrl }),
  });
}

export async function sendReviewReminderEmail(input: {
  to: string;
  productName: string;
  reviewUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `How was your ${input.productName}?`,
    react: ReviewReminderEmail({ productName: input.productName, reviewUrl: input.reviewUrl }),
  });
}

export async function sendWishlistReminderEmail(input: {
  to: string;
  productName: string;
  reason: string;
  productUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `${input.productName} is still on your wishlist`,
    react: WishlistReminderEmail({
      productName: input.productName,
      reason: input.reason,
      productUrl: input.productUrl,
    }),
  });
}

export async function sendCouponEmail(input: {
  to: string;
  code: string;
  description: string;
  shopUrl: string;
  expiresAt: string | null;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `A discount code for you: ${input.code}`,
    react: CouponEmail({
      code: input.code,
      description: input.description,
      shopUrl: input.shopUrl,
      expiresAt: input.expiresAt,
    }),
  });
}
