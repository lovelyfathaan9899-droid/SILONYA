import { formatDateInKarachi, formatPriceForDisplay } from "@silonya/utils";
import type {
  WhatsAppAdminNewOrderAlertData,
  WhatsAppDeliveredData,
  WhatsAppOrderConfirmationData,
  WhatsAppOutboundMessage,
  WhatsAppShippedData,
  WhatsAppStatusUpdateData,
} from "./types";

/**
 * Exact Meta template names this app is allowed to send — must match what's
 * registered (and APPROVED) in Meta Business Manager byte-for-byte,
 * including language. Referencing an unapproved/misspelled name here makes
 * the Cloud API reject the send with a template-not-found error; there is
 * no fallback — get these submitted and approved before going live.
 */
export const WHATSAPP_TEMPLATE_NAMES = {
  orderConfirmation: "order_confirmation",
  orderConfirmed: "order_confirmed",
  orderPacked: "order_packed",
  orderShipped: "order_shipped",
  orderOutForDelivery: "order_out_for_delivery",
  orderDelivered: "order_delivered",
  orderCancelled: "order_cancelled",
  // Internal, business-to-business alert (REAL-TIME ADMIN NOTIFICATION
  // SYSTEM spec) — sent to WHATSAPP_BUSINESS_PHONE, not a customer.
  adminNewOrderAlert: "admin_new_order_alert",
} as const;

const DEFAULT_LANGUAGE = "en";

function formatItemsList(items: WhatsAppOrderConfirmationData["items"]): string {
  return items
    .map((item) => {
      const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
      return `• ${String(item.quantity)}x ${item.name}${variant} — ${formatPriceForDisplay(item.lineTotal)}`;
    })
    .join("\n");
}

function paymentLine(paymentMethod: "cod" | "online", paymentReceived: boolean): string {
  if (paymentMethod === "cod") {
    return "Payment will be collected upon delivery.";
  }
  return paymentReceived ? "Payment received successfully." : "Awaiting payment confirmation.";
}

function paymentMethodLabel(paymentMethod: "cod" | "online"): string {
  return paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment";
}

/**
 * WHATSAPP_MESSAGE spec — customer name, order number/date, full item list,
 * subtotal/shipping/discount/grand total (PKR), address, payment
 * method+status line, estimated delivery, plus the Confirm/Cancel/Help
 * buttons (interactive-message-builder.ts supplies the payload strings this
 * function just forwards into the button components).
 *
 * Product images: WhatsApp template messages support at most one image, in
 * the HEADER — never a per-line-item gallery (a real Meta Cloud API
 * limitation, not a shortcut taken here). `headerImageUrl` is optional; the
 * template renders without a header component when it's not supplied
 * (e.g. no product image available, or WHATSAPP_ORDER_HEADER_IMAGE_URL
 * unset) — see TemplateManager callers for how that URL is sourced.
 */
export function buildOrderConfirmationMessage(
  data: WhatsAppOrderConfirmationData,
  headerImageUrl?: string,
): WhatsAppOutboundMessage {
  const components: WhatsAppOutboundMessage["components"] = [];

  if (headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: headerImageUrl } }],
    });
  }

  components.push({
    type: "body",
    parameters: [
      { type: "text", text: data.customerName },
      { type: "text", text: data.orderNumber },
      { type: "text", text: formatDateInKarachi(data.orderDate) },
      { type: "text", text: formatItemsList(data.items) },
      { type: "text", text: formatPriceForDisplay(data.subtotal, data.currency) },
      { type: "text", text: formatPriceForDisplay(data.shippingTotal, data.currency) },
      { type: "text", text: formatPriceForDisplay(data.discountTotal, data.currency) },
      { type: "text", text: formatPriceForDisplay(data.grandTotal, data.currency) },
      { type: "text", text: data.deliveryAddress },
      { type: "text", text: paymentMethodLabel(data.paymentMethod) },
      { type: "text", text: paymentLine(data.paymentMethod, data.paymentReceived) },
      {
        type: "text",
        text: data.estimatedDeliveryDate
          ? formatDateInKarachi(data.estimatedDeliveryDate)
          : "To be confirmed",
      },
    ],
  });

  // Quick-reply buttons 0 and 1 (Confirm, Cancel) carry a dynamic payload
  // encoding the order id; button 2 (Help) is a URL button and needs no
  // per-send parameter — its destination is fixed at template-approval
  // time to `https://wa.me/{{1}}` with the pre-filled text as the one URL
  // variable, or, if the approved template hardcodes the support number,
  // no button component at all is needed here. Both button 0 and 1 use
  // `sub_type: "quick_reply"` with a single `payload`-type parameter.
  components.push({
    type: "button",
    sub_type: "quick_reply",
    index: "0",
    parameters: [{ type: "payload", payload: data.confirmPayload }],
  });
  components.push({
    type: "button",
    sub_type: "quick_reply",
    index: "1",
    parameters: [{ type: "payload", payload: data.cancelPayload }],
  });

  return {
    to: data.customerPhone,
    templateName: WHATSAPP_TEMPLATE_NAMES.orderConfirmation,
    languageCode: DEFAULT_LANGUAGE,
    components,
  };
}

const STATUS_TEMPLATE_NAME: Record<WhatsAppStatusUpdateData["status"], string> = {
  confirmed: WHATSAPP_TEMPLATE_NAMES.orderConfirmed,
  packed: WHATSAPP_TEMPLATE_NAMES.orderPacked,
  out_for_delivery: WHATSAPP_TEMPLATE_NAMES.orderOutForDelivery,
  delivered: WHATSAPP_TEMPLATE_NAMES.orderDelivered,
  cancelled: WHATSAPP_TEMPLATE_NAMES.orderCancelled,
};

/** Generic lifecycle-stage template — confirmed/packed/out_for_delivery share this simple {{name}}/{{orderNumber}}/{{trackingUrl}} shape; shipped/delivered have their own richer builders below since they carry extra fields. */
export function buildStatusUpdateMessage(data: WhatsAppStatusUpdateData): WhatsAppOutboundMessage {
  const parameters: WhatsAppOutboundMessage["components"][number]["parameters"] = [
    { type: "text", text: data.customerName },
    { type: "text", text: data.orderNumber },
  ];
  if (data.status === "cancelled") {
    parameters.push({ type: "text", text: data.cancellationReason ?? "Order cancelled." });
  }
  parameters.push({ type: "text", text: data.orderTrackingUrl });

  return {
    to: data.customerPhone,
    templateName: STATUS_TEMPLATE_NAME[data.status],
    languageCode: DEFAULT_LANGUAGE,
    components: [{ type: "body", parameters }],
  };
}

/** SHIPPING_MESSAGE spec — tracking number, courier, tracking URL, ETA. */
export function buildShippedMessage(data: WhatsAppShippedData): WhatsAppOutboundMessage {
  return {
    to: data.customerPhone,
    templateName: WHATSAPP_TEMPLATE_NAMES.orderShipped,
    languageCode: DEFAULT_LANGUAGE,
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: data.customerName },
          { type: "text", text: data.orderNumber },
          { type: "text", text: data.trackingNumber },
          { type: "text", text: data.carrier },
          { type: "text", text: data.trackingUrl ?? "Not available" },
          {
            type: "text",
            text: data.estimatedDeliveryDate
              ? formatDateInKarachi(data.estimatedDeliveryDate)
              : "To be confirmed",
          },
        ],
      },
    ],
  };
}

/** DELIVERED spec — thank-you message + review request link. */
export function buildDeliveredMessage(data: WhatsAppDeliveredData): WhatsAppOutboundMessage {
  return {
    to: data.customerPhone,
    templateName: WHATSAPP_TEMPLATE_NAMES.orderDelivered,
    languageCode: DEFAULT_LANGUAGE,
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: data.customerName },
          { type: "text", text: data.orderNumber },
          { type: "text", text: data.reviewUrl },
        ],
      },
    ],
  };
}

/** REAL-TIME ADMIN NOTIFICATION SYSTEM spec's "WHATSAPP" section — order number, customer name/phone, total, payment method, order link, sent to the business's own phone rather than the customer's. */
export function buildAdminNewOrderAlertMessage(
  data: WhatsAppAdminNewOrderAlertData,
): WhatsAppOutboundMessage {
  return {
    to: data.businessPhone,
    templateName: WHATSAPP_TEMPLATE_NAMES.adminNewOrderAlert,
    languageCode: DEFAULT_LANGUAGE,
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: data.orderNumber },
          { type: "text", text: data.customerName },
          { type: "text", text: data.customerPhone },
          { type: "text", text: formatPriceForDisplay(data.grandTotal, data.currency) },
          {
            type: "text",
            text: data.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
          },
          { type: "text", text: data.orderAdminUrl },
        ],
      },
    ],
  };
}
