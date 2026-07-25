import { prisma } from "@silonya/database";
import { describe, expect, it } from "vitest";
import { createPendingOrder, createProductWithVariant } from "../../test/db";
import { cancelOrderViaWhatsApp, confirmOrderViaWhatsApp } from "./confirm-cancel";

function meta(overrides: Partial<Parameters<typeof confirmOrderViaWhatsApp>[1]> = {}) {
  return {
    waMessageId: `wamid.test-${crypto.randomUUID()}`,
    fromPhone: "923001234567",
    timestamp: new Date(),
    customerIp: null,
    ...overrides,
  };
}

describe("confirmOrderViaWhatsApp (integration)", () => {
  it("moves a pending_confirmation order to confirmed and logs the timeline event", async () => {
    const { variant } = await createProductWithVariant({ quantityOnHand: 5, quantityReserved: 0 });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      status: "pending_confirmation",
    });

    await confirmOrderViaWhatsApp(order.id, meta());

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("confirmed");

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("confirmed");
    expect(events[0]?.triggeredBy).toBe("customer");
    expect(events[0]?.note).toBe("Confirmed via WhatsApp");
  });

  it("records a WhatsAppEvent with the message id and phone even when nothing changes", async () => {
    const { variant } = await createProductWithVariant({ quantityOnHand: 5, quantityReserved: 0 });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      status: "confirmed", // already confirmed — a second/duplicate webhook delivery
    });

    await confirmOrderViaWhatsApp(
      order.id,
      meta({ waMessageId: "wamid.dup-1", fromPhone: "923009999999" }),
    );

    const stillConfirmed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stillConfirmed.status).toBe("confirmed");

    // No new OrderStatusEvent — the transition guard is what makes this idempotent.
    const events = await prisma.orderStatusEvent.count({ where: { orderId: order.id } });
    expect(events).toBe(0);

    const whatsAppEvents = await prisma.whatsAppEvent.findMany({ where: { orderId: order.id } });
    expect(whatsAppEvents).toHaveLength(1);
    expect(whatsAppEvents[0]?.type).toBe("button_confirm");
    expect(whatsAppEvents[0]?.waMessageId).toBe("wamid.dup-1");
    expect(whatsAppEvents[0]?.fromPhone).toBe("923009999999");
  });

  it("is idempotent — confirming the same order twice only transitions it once", async () => {
    const { variant } = await createProductWithVariant({ quantityOnHand: 5, quantityReserved: 0 });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      status: "pending_confirmation",
    });

    await confirmOrderViaWhatsApp(order.id, meta({ waMessageId: "wamid.first" }));
    await confirmOrderViaWhatsApp(order.id, meta({ waMessageId: "wamid.redelivered" }));

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);

    const whatsAppEvents = await prisma.whatsAppEvent.count({ where: { orderId: order.id } });
    expect(whatsAppEvents).toBe(2); // both webhook deliveries are still recorded for audit
  });
});

describe("cancelOrderViaWhatsApp (integration)", () => {
  it("cancels a pending_confirmation order and restores the inventory that was finalized at checkout", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 4, // simulates stock already decremented by finalizeReservation at checkout
      quantityReserved: 0,
    });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      status: "pending_confirmation",
    });

    await cancelOrderViaWhatsApp(order.id, meta());

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("cancelled");

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityOnHand).toBe(5); // restocked by 1

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("cancelled");
    expect(events[0]?.triggeredBy).toBe("customer");
    expect(events[0]?.note).toBe("Cancelled via WhatsApp");
  });

  it("does not restock or transition an order that's already past pending_confirmation", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 4,
      quantityReserved: 0,
    });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      status: "confirmed",
    });

    await cancelOrderViaWhatsApp(order.id, meta());

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("confirmed"); // unchanged — Cancel only applies to pending_confirmation

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityOnHand).toBe(4); // not restocked
  });
});
