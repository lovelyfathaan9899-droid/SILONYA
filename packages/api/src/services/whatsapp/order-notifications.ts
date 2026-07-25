import { prisma, type Order, type OrderItem, type Address } from "@silonya/database";
import { signOrderAccessToken } from "@silonya/auth";
import {
  buildCancelPayload,
  buildConfirmPayload,
  buildDeliveredMessage,
  buildHelpWaLink,
  buildOrderConfirmationMessage,
  buildShippedMessage,
  buildStatusUpdateMessage,
  toMetaPhoneFormat,
  type WhatsAppStatus,
} from "@silonya/whatsapp";
import { siteUrl } from "../../lib/site-url";
import { enqueueWhatsAppMessage } from "./outbox";

type OrderWithItemsAndAddress = Order & { items: OrderItem[]; shippingAddress: Address };

function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.countryCode,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.join(", ");
}

async function orderTrackingUrl(orderId: string, guestEmail: string | null): Promise<string> {
  if (!guestEmail) return `${siteUrl()}/orders/track`;
  const token = await signOrderAccessToken({ orderId, email: guestEmail });
  return `${siteUrl()}/order/confirmation?token=${token}`;
}

/** WhatsApp sends target the customer's dedicated WhatsApp number when they gave one at checkout, falling back to their regular contact number otherwise — most customers use the same line for both. */
function whatsAppTargetPhone(address: Address): string | null {
  return address.whatsappPhone ?? address.phone;
}

/** Support number for the Help button's wa.me deep link — falls back to the business's own sending number when a distinct support line isn't configured. */
function supportPhone(): string {
  const configured = process.env.WHATSAPP_SUPPORT_PHONE ?? process.env.WHATSAPP_BUSINESS_PHONE;
  return configured ? toMetaPhoneFormat(configured) : "";
}

/**
 * ORDER FLOW spec — sent immediately on order creation, before the customer
 * has confirmed anything (that's exactly the point: the Confirm/Cancel
 * buttons on this message are what drives pending_confirmation → confirmed
 * or cancelled). `estimatedDeliveryDate` is derived from the shipping
 * method the same way the storefront's own copy describes it (2-5 / 1-2
 * business days) rather than a stored column — there's no separate ETA
 * field on Order.
 */
export async function sendOrderConfirmationWhatsApp(
  order: OrderWithItemsAndAddress,
): Promise<void> {
  const customerPhone = whatsAppTargetPhone(order.shippingAddress);
  if (!customerPhone) return;

  const trackingUrl = await orderTrackingUrl(order.id, order.guestEmail);
  const estimatedDeliveryDate = estimateDeliveryDate(order.shippingMethod, order.createdAt);

  const message = buildOrderConfirmationMessage(
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      customerName: order.shippingAddress.fullName ?? "Customer",
      customerPhone,
      items: order.items.map((item) => ({
        name: item.productNameSnapshot,
        variantLabel: item.variantLabelSnapshot || null,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal,
      discountTotal: order.discountTotal,
      grandTotal: order.grandTotal,
      currency: order.currency,
      deliveryAddress: formatAddress(order.shippingAddress),
      paymentMethod: order.paymentMethod,
      paymentReceived: order.paymentMethod === "online" && order.status === "paid",
      estimatedDeliveryDate,
      orderTrackingUrl: trackingUrl,
      confirmPayload: buildConfirmPayload(order.id),
      cancelPayload: buildCancelPayload(order.id),
      helpWaLink: buildHelpWaLink(supportPhone(), order.orderNumber),
    },
    process.env.WHATSAPP_ORDER_HEADER_IMAGE_URL,
  );

  await enqueueWhatsAppMessage({ orderId: order.id, type: "order_confirmation", message });
}

/** Standard/Express delivery windows — mirrors the copy shown at checkout (apps/web/app/checkout/page.tsx's SHIPPING_OPTIONS). */
function estimateDeliveryDate(shippingMethod: string, from: Date): Date {
  const businessDays = shippingMethod === "express" ? 2 : 5;
  return new Date(from.getTime() + businessDays * 24 * 60 * 60 * 1000);
}

const NOTIFIABLE_STATUSES = new Set<WhatsAppStatus>([
  "confirmed",
  "packed",
  "out_for_delivery",
  "cancelled",
]);

/**
 * ORDER STATUS NOTIFICATIONS spec — confirmed/packed/out_for_delivery/
 * cancelled share the simple template; shipped/delivered are handled by
 * their own dedicated functions below (richer payloads: tracking info,
 * review link). Silently no-ops for any other Order.status value so this
 * is safe to call from a generic "status changed" hook without the caller
 * needing to know which statuses are WhatsApp-notifiable.
 */
export async function sendOrderStatusWhatsApp(
  order: OrderWithItemsAndAddress,
  status: string,
  cancellationReason?: string,
): Promise<void> {
  const customerPhone = whatsAppTargetPhone(order.shippingAddress);
  if (!customerPhone) return;
  if (!NOTIFIABLE_STATUSES.has(status as WhatsAppStatus)) return;

  const trackingUrl = await orderTrackingUrl(order.id, order.guestEmail);
  const message = buildStatusUpdateMessage({
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.shippingAddress.fullName ?? "Customer",
    customerPhone,
    status: status as WhatsAppStatus,
    orderTrackingUrl: trackingUrl,
    ...(cancellationReason ? { cancellationReason } : {}),
  });

  await enqueueWhatsAppMessage({ orderId: order.id, type: "status_update", message });
}

/** SHIPPING_MESSAGE spec — tracking number, courier, tracking URL, ETA. */
export async function sendShippedWhatsApp(
  order: OrderWithItemsAndAddress,
  input: { trackingNumber: string; carrier: string; trackingUrl: string | null },
): Promise<void> {
  const customerPhone = whatsAppTargetPhone(order.shippingAddress);
  if (!customerPhone) return;

  const estimatedDeliveryDate = estimateDeliveryDate(order.shippingMethod, new Date());
  const message = buildShippedMessage({
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.shippingAddress.fullName ?? "Customer",
    customerPhone,
    trackingNumber: input.trackingNumber,
    carrier: input.carrier,
    trackingUrl: input.trackingUrl,
    estimatedDeliveryDate,
  });

  await enqueueWhatsAppMessage({ orderId: order.id, type: "shipped", message });
}

/** DELIVERED spec — thank-you + review request, linking to the first item's product page. */
export async function sendDeliveredWhatsApp(order: OrderWithItemsAndAddress): Promise<void> {
  const customerPhone = whatsAppTargetPhone(order.shippingAddress);
  if (!customerPhone) return;

  const firstItem = order.items[0];
  const product = firstItem
    ? await prisma.productVariant.findUnique({
        where: { id: firstItem.variantId },
        include: { product: { select: { slug: true } } },
      })
    : null;
  const reviewUrl = product
    ? `${siteUrl()}/products/${product.product.slug}#reviews`
    : `${siteUrl()}/account/orders`;

  const message = buildDeliveredMessage({
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.shippingAddress.fullName ?? "Customer",
    customerPhone,
    reviewUrl,
  });

  await enqueueWhatsAppMessage({ orderId: order.id, type: "delivered", message });
}
