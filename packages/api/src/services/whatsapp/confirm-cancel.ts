import { prisma } from "@silonya/database";
import { getDefaultWarehouseId } from "../../routers/admin-catalog/shared";
import { restockInventory } from "../inventory";
import { createDashboardNotification } from "../notifications/notification-service";

export interface WhatsAppButtonWebhookMeta {
  /** The inbound button-reply message's own wamid — stored on the WhatsAppEvent row (DELIVERABLE spec's "Message ID"). */
  waMessageId: string;
  /** Customer's WhatsApp number as Meta reports it on the inbound event. */
  fromPhone: string;
  timestamp: Date;
  /**
   * Always null for a pure webhook-sourced event — the WhatsApp Cloud API
   * webhook never carries the end customer's IP address (the message is
   * relayed through Meta's infrastructure, not a direct request from the
   * customer's device). Kept in the signature for forward-compatibility
   * with a future, different confirmation entry point that could supply
   * one; do not fabricate a value here.
   */
  customerIp?: string | null;
}

async function recordButtonEvent(
  orderId: string,
  type: "button_confirm" | "button_cancel",
  meta: WhatsAppButtonWebhookMeta,
  rawPayload: unknown,
): Promise<void> {
  const latestMessage = await prisma.whatsAppMessage.findFirst({
    where: { orderId, type: "order_confirmation" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  await prisma.whatsAppEvent.create({
    data: {
      orderId,
      messageId: latestMessage?.id ?? null,
      type,
      payload: (rawPayload ?? {}) as never,
      waMessageId: meta.waMessageId,
      fromPhone: meta.fromPhone,
      customerIp: meta.customerIp ?? null,
    },
  });
}

/**
 * CONFIRM ORDER spec — pending_confirmation → confirmed, "Confirmed via
 * WhatsApp" timeline event, admin dashboard notified. Idempotent: Meta
 * redelivers webhooks at-least-once, and a customer can double-tap before
 * the first tap's response renders — a second confirm on an
 * already-confirmed order is a no-op (still recorded as a WhatsAppEvent for
 * the audit trail, just without a second state transition or duplicate
 * OrderStatusEvent).
 */
export async function confirmOrderViaWhatsApp(
  orderId: string,
  meta: WhatsAppButtonWebhookMeta,
  rawPayload?: unknown,
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error(`[whatsapp] confirm: order ${orderId} not found (wamid ${meta.waMessageId}).`);
    return;
  }

  if (order.status === "pending_confirmation") {
    await prisma.$transaction(
      async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: "confirmed" } });
        await tx.orderStatusEvent.create({
          data: {
            orderId,
            status: "confirmed",
            triggeredBy: "customer",
            note: "Confirmed via WhatsApp",
          },
        });
      },
      { timeout: 10000 },
    );

    await createDashboardNotification({
      category: "orders",
      title: "Order confirmed via WhatsApp",
      body: `${order.orderNumber} was confirmed by the customer.`,
      linkUrl: `/orders/${order.id}`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });
  }

  await recordButtonEvent(orderId, "button_confirm", meta, rawPayload);
}

/**
 * CANCEL ORDER spec — status → cancelled (customer-triggered), inventory
 * restored (the reservation was already finalized/deducted from
 * quantityOnHand at checkout — see checkout/index.ts — so this needs
 * restockInventory, the same helper admin-driven cancellation uses, not
 * releaseReservation), reason logged, admin dashboard notified,
 * cancellation timestamp stored (OrderStatusEvent.createdAt). Only acts
 * from pending_confirmation — once an order has moved past that (admin
 * already confirmed it another way, or it's already cancelled/further
 * along), a stale Cancel tap is a no-op, matching confirmOrderViaWhatsApp's
 * idempotency shape.
 */
export async function cancelOrderViaWhatsApp(
  orderId: string,
  meta: WhatsAppButtonWebhookMeta,
  rawPayload?: unknown,
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) {
    console.error(`[whatsapp] cancel: order ${orderId} not found (wamid ${meta.waMessageId}).`);
    return;
  }

  if (order.status === "pending_confirmation") {
    const warehouseId = await getDefaultWarehouseId();
    await prisma.$transaction(
      async (tx) => {
        await restockInventory(tx, order.items, warehouseId);
        await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
        await tx.orderStatusEvent.create({
          data: {
            orderId,
            status: "cancelled",
            triggeredBy: "customer",
            note: "Cancelled via WhatsApp",
          },
        });
      },
      { timeout: 10000 },
    );

    await createDashboardNotification({
      category: "orders",
      title: "Order cancelled by customer",
      body: `${order.orderNumber} was cancelled by the customer via WhatsApp.`,
      linkUrl: `/orders/${order.id}`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });
  }

  await recordButtonEvent(orderId, "button_cancel", meta, rawPayload);
}
