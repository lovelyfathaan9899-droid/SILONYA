/**
 * Every outbound send is a WhatsApp Business Cloud API *template* message —
 * never a free-form "interactive" message — because every message this
 * system sends is business-initiated (order events, not a reply inside an
 * active customer-service window). Meta only allows business-initiated
 * messages through pre-approved templates; free-form/interactive messages
 * are restricted to the 24-hour window after a customer messages first.
 * The Confirm/Cancel quick-reply buttons and the Help URL button are
 * therefore built as components of the template itself (see
 * interactive-message-builder.ts), not a separate message type.
 */

export interface WhatsAppTemplateParameterText {
  type: "text";
  text: string;
}

export interface WhatsAppTemplateParameterImage {
  type: "image";
  image: { link: string };
}

export interface WhatsAppTemplateParameterPayload {
  type: "payload";
  payload: string;
}

export type WhatsAppTemplateParameter =
  WhatsAppTemplateParameterText | WhatsAppTemplateParameterImage | WhatsAppTemplateParameterPayload;

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppOutboundMessage {
  /** E.164 with no leading "+" — Meta's own convention (e.g. "923001234567"). */
  to: string;
  templateName: string;
  languageCode: string;
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppSendResult {
  success: boolean;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawResponse: unknown;
}

export interface WhatsAppOrderItem {
  name: string;
  variantLabel: string | null;
  quantity: number;
  /** Minor units (paisa) — formatted with @silonya/utils's formatPriceForDisplay before going into template text. */
  lineTotal: number;
}

export interface WhatsAppOrderConfirmationData {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  customerName: string;
  /** E.164 with leading "+" (storefront/DB convention) — converted to Meta's no-"+" form inside the client. */
  customerPhone: string;
  items: WhatsAppOrderItem[];
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: string;
  deliveryAddress: string;
  paymentMethod: "cod" | "online";
  /** true only for a prepaid order already marked paid; COD orders are always false ("Payment will be collected upon delivery."). */
  paymentReceived: boolean;
  estimatedDeliveryDate: Date | null;
  orderTrackingUrl: string;
  /** Order id-derived button payloads (interactive-message-builder.ts) — resolved here so the template builder stays pure. */
  confirmPayload: string;
  cancelPayload: string;
  helpWaLink: string;
}

export type WhatsAppStatus =
  "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";

export interface WhatsAppStatusUpdateData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: WhatsAppStatus;
  orderTrackingUrl: string;
  /** Only meaningful for `cancelled`; omitted otherwise. */
  cancellationReason?: string;
}

export interface WhatsAppShippedData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl: string | null;
  estimatedDeliveryDate: Date | null;
}

export interface WhatsAppDeliveredData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  reviewUrl: string;
}

export interface WhatsAppAdminNewOrderAlertData {
  /** E.164 with leading "+", the business/owner's own phone — not the customer's. */
  businessPhone: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  grandTotal: number;
  currency: string;
  paymentMethod: "cod" | "online";
  orderAdminUrl: string;
}
