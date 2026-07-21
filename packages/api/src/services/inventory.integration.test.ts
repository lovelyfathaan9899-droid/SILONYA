import { prisma } from "@silonya/database";
import { describe, expect, it } from "vitest";
import { createProductWithVariant } from "../test/db";
import { reserveInventory } from "./inventory";

describe("reserveInventory (integration)", () => {
  it("reserves stock and increments quantityReserved when available", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 10,
      quantityReserved: 2,
    });

    const reserved = await prisma.$transaction((tx) =>
      reserveInventory(tx, variant.id, warehouseId, 3),
    );

    expect(reserved).toBe(true);
    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityReserved).toBe(5);
    expect(inventory.quantityOnHand).toBe(10);
  });

  it("refuses to reserve more than is available, leaving inventory untouched", async () => {
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: 5,
      quantityReserved: 4, // only 1 available
    });

    const reserved = await prisma.$transaction((tx) =>
      reserveInventory(tx, variant.id, warehouseId, 2),
    );

    expect(reserved).toBe(false);
    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityReserved).toBe(4);
  });

  it("returns false for a variant/warehouse pair with no inventory row", async () => {
    const { warehouseId } = await createProductWithVariant();
    const reserved = await prisma.$transaction((tx) =>
      reserveInventory(tx, crypto.randomUUID(), warehouseId, 1),
    );
    expect(reserved).toBe(false);
  });

  /**
   * The flagship oversell-prevention test (TESTING_STRATEGY.md §4,
   * PRODUCT_SYSTEM.md §4.3): fire more concurrent reservation attempts than
   * there is stock for, against a real Postgres connection pool, and assert
   * exactly the available quantity succeeds — never more, never fewer. This
   * only proves anything because it runs against real Postgres row-level
   * locking; a mocked Prisma client can't fail this test the way a broken
   * read-then-write implementation would against the real thing.
   */
  it("under concurrent load, lets exactly the available quantity succeed and no more", async () => {
    const AVAILABLE = 5;
    const ATTEMPTS = 20;
    const { variant, warehouseId } = await createProductWithVariant({
      quantityOnHand: AVAILABLE,
      quantityReserved: 0,
    });

    // maxWait/timeout raised well past Prisma's defaults (2s/5s) — at 20-way
    // concurrency, most of these are legitimately queued waiting for a free
    // connection from Prisma's own client-side pool while earlier ones hold
    // the inventory row's lock; that queueing is expected and not itself
    // part of what this test is verifying.
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () =>
        prisma.$transaction((tx) => reserveInventory(tx, variant.id, warehouseId, 1), {
          maxWait: 15000,
          timeout: 15000,
        }),
      ),
    );

    const succeeded = results.filter(Boolean).length;
    expect(succeeded).toBe(AVAILABLE);

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id, warehouseId },
    });
    expect(inventory.quantityReserved).toBe(AVAILABLE);
    expect(inventory.quantityOnHand).toBe(AVAILABLE);
  });
});
