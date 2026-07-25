import { describe, expect, it } from "vitest";
import {
  buildDeliveredMessage,
  buildOrderConfirmationMessage,
  buildShippedMessage,
  buildStatusUpdateMessage,
  WHATSAPP_TEMPLATE_NAMES,
} from "./template-manager";
import type { WhatsAppOrderConfirmationData } from "./types";

function baseOrderData(
  overrides: Partial<WhatsAppOrderConfirmationData> = {},
): WhatsAppOrderConfirmationData {
  return {
    orderId: "order-1",
    orderNumber: "SIL-100001",
    orderDate: new Date("2026-07-25T10:00:00Z"),
    customerName: "Ayesha Khan",
    customerPhone: "+923001234567",
    items: [
      { name: "Wool Overcoat", variantLabel: "S / Black", quantity: 1, lineTotal: 42000 },
      { name: "Silk Slip Dress", variantLabel: null, quantity: 2, lineTotal: 56000 },
    ],
    subtotal: 98000,
    shippingTotal: 25000,
    discountTotal: 0,
    grandTotal: 123000,
    currency: "PKR",
    deliveryAddress: "House 12, Street 4, F-8/3, Islamabad",
    paymentMethod: "cod",
    paymentReceived: false,
    estimatedDeliveryDate: new Date("2026-07-28T00:00:00Z"),
    orderTrackingUrl: "https://silonya.com/order/confirmation?token=abc",
    confirmPayload: "CONFIRM_ORDER_order-1",
    cancelPayload: "CANCEL_ORDER_order-1",
    helpWaLink: "https://wa.me/923001234567?text=help",
    ...overrides,
  };
}

describe("buildOrderConfirmationMessage", () => {
  it("targets the order_confirmation template", () => {
    const message = buildOrderConfirmationMessage(baseOrderData());
    expect(message.templateName).toBe(WHATSAPP_TEMPLATE_NAMES.orderConfirmation);
    expect(message.to).toBe("+923001234567");
  });

  it("omits the header component when no header image is supplied", () => {
    const message = buildOrderConfirmationMessage(baseOrderData());
    expect(message.components.find((c) => c.type === "header")).toBeUndefined();
  });

  it("includes a header component when a header image is supplied", () => {
    const message = buildOrderConfirmationMessage(
      baseOrderData(),
      "https://cdn.silonya.com/banner.jpg",
    );
    const header = message.components.find((c) => c.type === "header");
    expect(header?.parameters).toEqual([
      { type: "image", image: { link: "https://cdn.silonya.com/banner.jpg" } },
    ]);
  });

  it("shows the COD payment line for cash-on-delivery orders", () => {
    const message = buildOrderConfirmationMessage(baseOrderData({ paymentMethod: "cod" }));
    const body = message.components.find((c) => c.type === "body");
    const texts = body?.parameters.map((p) => (p.type === "text" ? p.text : null));
    expect(texts).toContain("Payment will be collected upon delivery.");
  });

  it("shows the paid confirmation line for a prepaid, already-paid order", () => {
    const message = buildOrderConfirmationMessage(
      baseOrderData({ paymentMethod: "online", paymentReceived: true }),
    );
    const body = message.components.find((c) => c.type === "body");
    const texts = body?.parameters.map((p) => (p.type === "text" ? p.text : null));
    expect(texts).toContain("Payment received successfully.");
  });

  it("formats every product line with quantity, name, variant, and PKR price", () => {
    const message = buildOrderConfirmationMessage(baseOrderData());
    const body = message.components.find((c) => c.type === "body");
    const itemsText = body?.parameters[3];
    expect(itemsText?.type === "text" ? itemsText.text : null).toBe(
      "• 1x Wool Overcoat (S / Black) — PKR 420\n• 2x Silk Slip Dress — PKR 560",
    );
  });

  it("attaches Confirm and Cancel as quick-reply button components carrying the order-scoped payloads", () => {
    const message = buildOrderConfirmationMessage(baseOrderData());
    const buttons = message.components.filter((c) => c.type === "button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatchObject({
      sub_type: "quick_reply",
      index: "0",
      parameters: [{ type: "payload", payload: "CONFIRM_ORDER_order-1" }],
    });
    expect(buttons[1]).toMatchObject({
      sub_type: "quick_reply",
      index: "1",
      parameters: [{ type: "payload", payload: "CANCEL_ORDER_order-1" }],
    });
  });
});

describe("buildStatusUpdateMessage", () => {
  it("maps each lifecycle status to its own approved template name", () => {
    const confirmed = buildStatusUpdateMessage({
      orderId: "o1",
      orderNumber: "SIL-1",
      customerName: "Ayesha",
      customerPhone: "+923001234567",
      status: "confirmed",
      orderTrackingUrl: "https://x",
    });
    expect(confirmed.templateName).toBe(WHATSAPP_TEMPLATE_NAMES.orderConfirmed);

    const cancelled = buildStatusUpdateMessage({
      orderId: "o1",
      orderNumber: "SIL-1",
      customerName: "Ayesha",
      customerPhone: "+923001234567",
      status: "cancelled",
      orderTrackingUrl: "https://x",
      cancellationReason: "Cancelled via WhatsApp",
    });
    expect(cancelled.templateName).toBe(WHATSAPP_TEMPLATE_NAMES.orderCancelled);
    const body = cancelled.components[0];
    const texts = body?.parameters.map((p) => (p.type === "text" ? p.text : null));
    expect(texts).toContain("Cancelled via WhatsApp");
  });
});

describe("buildShippedMessage", () => {
  it("includes tracking number, courier, tracking URL, and ETA", () => {
    const message = buildShippedMessage({
      orderId: "o1",
      orderNumber: "SIL-1",
      customerName: "Ayesha",
      customerPhone: "+923001234567",
      trackingNumber: "TCS1234567",
      carrier: "TCS",
      trackingUrl: "https://tcsexpress.com/track/TCS1234567",
      estimatedDeliveryDate: new Date("2026-07-28T00:00:00Z"),
    });
    expect(message.templateName).toBe(WHATSAPP_TEMPLATE_NAMES.orderShipped);
    const body = message.components[0];
    const texts = body?.parameters.map((p) => (p.type === "text" ? p.text : null));
    expect(texts).toEqual(
      expect.arrayContaining(["TCS1234567", "TCS", "https://tcsexpress.com/track/TCS1234567"]),
    );
  });
});

describe("buildDeliveredMessage", () => {
  it("targets the order_delivered template with a review link", () => {
    const message = buildDeliveredMessage({
      orderId: "o1",
      orderNumber: "SIL-1",
      customerName: "Ayesha",
      customerPhone: "+923001234567",
      reviewUrl: "https://silonya.com/products/wool-overcoat#review",
    });
    expect(message.templateName).toBe(WHATSAPP_TEMPLATE_NAMES.orderDelivered);
    const body = message.components[0];
    const texts = body?.parameters.map((p) => (p.type === "text" ? p.text : null));
    expect(texts).toContain("https://silonya.com/products/wool-overcoat#review");
  });
});
