import { prisma } from "@silonya/database";
import { describe, expect, it } from "vitest";
import { createPendingOrder, createProductWithVariant, createWarehouse } from "../test/db";
import { releaseExpiredReservations } from "./order-fulfillment";

const SIXTEEN_MINUTES_AGO = new Date(Date.now() - 16 * 60 * 1000);
const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);

describe("releaseExpiredReservations (integration)", () => {
  it("cancels a stale pending_payment order and releases its reservation", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 10,
      quantityReserved: 1, // simulates the reservation this order holds
    });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      createdAt: SIXTEEN_MINUTES_AGO,
    });

    const result = await releaseExpiredReservations();

    expect(result.releasedCount).toBe(1);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("cancelled");

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityReserved).toBe(0);
    expect(inventory.quantityOnHand).toBe(10);

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("cancelled");
    expect(events[0]?.triggeredBy).toBe("system");
  });

  it("leaves a recent pending_payment order untouched", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 10,
      quantityReserved: 1,
    });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      createdAt: FIVE_MINUTES_AGO,
    });

    const result = await releaseExpiredReservations();

    expect(result.releasedCount).toBe(0);
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("pending_payment");
    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityReserved).toBe(1);
  });

  it("never touches an order that isn't pending_payment, even if old", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 10,
      quantityReserved: 0,
    });
    const order = await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      status: "paid",
      createdAt: SIXTEEN_MINUTES_AGO,
    });

    const result = await releaseExpiredReservations();

    expect(result.releasedCount).toBe(0);
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("paid");
    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityReserved).toBe(0);
  });

  it("is idempotent — running twice doesn't double-process or error", async () => {
    const { variant } = await createProductWithVariant({
      quantityOnHand: 10,
      quantityReserved: 1,
    });
    await createPendingOrder({
      variantId: variant.id,
      quantity: 1,
      createdAt: SIXTEEN_MINUTES_AGO,
    });

    const first = await releaseExpiredReservations();
    const second = await releaseExpiredReservations();

    expect(first.releasedCount).toBe(1);
    expect(second.releasedCount).toBe(0);
  });

  it("processes multiple stale orders across different variants", async () => {
    // Both variants must share the same (only) default warehouse —
    // releaseExpiredReservations resolves the warehouse once via
    // getDefaultWarehouseId(), matching the app's single-default-warehouse
    // assumption; two independently-created `isDefault: true` warehouses
    // would make that lookup ambiguous in a way production data never is.
    const { id: warehouseId } = await createWarehouse();
    const a = await createProductWithVariant({
      warehouseId,
      quantityOnHand: 5,
      quantityReserved: 1,
    });
    const b = await createProductWithVariant({
      warehouseId,
      quantityOnHand: 5,
      quantityReserved: 2,
    });
    await createPendingOrder({
      variantId: a.variant.id,
      quantity: 1,
      createdAt: SIXTEEN_MINUTES_AGO,
    });
    await createPendingOrder({
      variantId: b.variant.id,
      quantity: 2,
      createdAt: SIXTEEN_MINUTES_AGO,
    });

    const result = await releaseExpiredReservations();

    expect(result.releasedCount).toBe(2);
    const invA = await prisma.inventory.findFirstOrThrow({ where: { variantId: a.variant.id } });
    const invB = await prisma.inventory.findFirstOrThrow({ where: { variantId: b.variant.id } });
    expect(invA.quantityReserved).toBe(0);
    expect(invB.quantityReserved).toBe(0);
  });
});
