import { prisma } from "@silonya/database";
import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../../root";
import { createProductWithVariant } from "../../test/db";

function caller() {
  return appRouter.createCaller({ adminSession: null, customerSession: null });
}

function uniqueEmail() {
  return `test-${crypto.randomUUID()}@example.com`;
}

const SHIPPING_ADDRESS = {
  fullName: "Ayesha Khan",
  line1: "House 12, Street 4, F-8/3",
  line2: "Near Kohsar Market",
  city: "Islamabad",
  region: "Islamabad Capital Territory",
  postalCode: "44000",
  countryCode: "PK",
  phone: "+923001234567",
};

/** PKR 6,000 basePrice clears the standard-shipping free threshold (PKR 5,000), and a 100%-off automatic discount then zeroes the subtotal — together the order is fully covered, landing on the "paid" (not "processing") status path (checkout/index.ts), so these tests exercise the real reservation → order → discount-redemption transaction without needing cash due on delivery. */
async function createFullyDiscountedProduct(
  overrides: Parameters<typeof createProductWithVariant>[0] = {},
) {
  const fixture = await createProductWithVariant({ basePrice: 600000, ...overrides });
  await prisma.discount.create({
    data: { code: null, type: "percentage", value: 100 },
  });
  return fixture;
}

describe("checkout.createIntent (integration)", () => {
  it("reserves inventory, creates a paid order, and records the discount redemption", async () => {
    const { variant } = await createFullyDiscountedProduct({
      quantityOnHand: 5,
      quantityReserved: 0,
    });

    const result = await caller().checkout.createIntent({
      items: [{ variantId: variant.id, quantity: 1 }],
      guestEmail: uniqueEmail(),
      shippingAddress: SHIPPING_ADDRESS,
      paymentMethod: "cod" as const,
      shippingMethod: "standard" as const,
    });

    expect(result.orderId).toBeTruthy();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.status).toBe("paid");
    expect(order.grandTotal).toBe(0);

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(4);
    expect(inventory.quantityReserved).toBe(0);

    const redemptions = await prisma.discountRedemption.count({ where: { orderId: order.id } });
    expect(redemptions).toBe(1);
  });

  it("rejects checkout for a sold-out item and leaves no order behind", async () => {
    const { variant } = await createProductWithVariant({
      quantityOnHand: 1,
      quantityReserved: 1, // 0 available
    });
    const email = uniqueEmail();

    await expect(
      caller().checkout.createIntent({
        items: [{ variantId: variant.id, quantity: 1 }],
        guestEmail: email,
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: "cod" as const,
        shippingMethod: "standard" as const,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<TRPCError>);

    const orders = await prisma.order.count({ where: { guestEmail: email } });
    expect(orders).toBe(0);

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(1);
    expect(inventory.quantityReserved).toBe(1);
  });

  /**
   * TESTING_STRATEGY.md §4's concurrency requirement, exercised through the
   * real public procedure boundary (not just the underlying SQL helper,
   * which inventory.integration.test.ts already covers in isolation): fire
   * more simultaneous checkout attempts than there is stock for and assert
   * exactly the available quantity succeeds.
   */
  it("under concurrent checkout attempts, sells exactly the available stock and no more", async () => {
    const AVAILABLE = 3;
    const ATTEMPTS = 8;
    const { variant } = await createFullyDiscountedProduct({
      quantityOnHand: AVAILABLE,
      quantityReserved: 0,
    });

    const results = await Promise.allSettled(
      Array.from({ length: ATTEMPTS }, () =>
        caller().checkout.createIntent({
          items: [{ variantId: variant.id, quantity: 1 }],
          guestEmail: uniqueEmail(),
          shippingAddress: SHIPPING_ADDRESS,
          paymentMethod: "cod" as const,
          shippingMethod: "standard" as const,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const rejectedReasons = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r): unknown => r.reason);
    expect(succeeded).toBe(AVAILABLE);
    expect(rejectedReasons).toHaveLength(ATTEMPTS - AVAILABLE);

    for (const reason of rejectedReasons) {
      expect(reason).toMatchObject({ code: "CONFLICT" });
    }

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(0);
    expect(inventory.quantityReserved).toBe(0);

    const paidOrders = await prisma.order.count({ where: { status: "paid" } });
    expect(paidOrders).toBe(AVAILABLE);
  });

  it("creates a non-zero-total COD order as 'processing' with cash due on delivery, no Stripe involved", async () => {
    const { variant } = await createProductWithVariant({
      basePrice: 150000, // PKR 1,500 — real balance due, below the free-shipping threshold
      quantityOnHand: 5,
      quantityReserved: 0,
    });

    const result = await caller().checkout.createIntent({
      items: [{ variantId: variant.id, quantity: 1 }],
      guestEmail: uniqueEmail(),
      shippingAddress: SHIPPING_ADDRESS,
      paymentMethod: "cod",
      shippingMethod: "standard",
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { payment: true },
    });
    expect(order.status).toBe("processing");
    expect(order.paymentMethod).toBe("cod");
    expect(order.shippingMethod).toBe("standard");
    expect(order.grandTotal).toBeGreaterThan(0);
    expect(order.currency).toBe("PKR");
    expect(order.placedAt).not.toBeNull();
    // No payment gateway involved for COD — no Payment row is ever created.
    expect(order.payment).toBeNull();

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(4);
    expect(inventory.quantityReserved).toBe(0);
  });

  it("charges the express shipping rate regardless of subtotal", async () => {
    const { variant } = await createProductWithVariant({
      basePrice: 900000, // PKR 9,000 — well above the standard free-shipping threshold
      quantityOnHand: 5,
      quantityReserved: 0,
    });

    const result = await caller().checkout.createIntent({
      items: [{ variantId: variant.id, quantity: 1 }],
      guestEmail: uniqueEmail(),
      shippingAddress: SHIPPING_ADDRESS,
      paymentMethod: "cod",
      shippingMethod: "express",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.shippingMethod).toBe("express");
    expect(order.shippingTotal).toBe(50000); // PKR 500 — never waived by order size
  });

  it("rejects 'online' as a payment method before touching inventory or creating an order", async () => {
    const { variant } = await createProductWithVariant({
      quantityOnHand: 5,
      quantityReserved: 0,
    });
    const email = uniqueEmail();

    await expect(
      caller().checkout.createIntent({
        items: [{ variantId: variant.id, quantity: 1 }],
        guestEmail: email,
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: "online",
        shippingMethod: "standard",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" } satisfies Partial<TRPCError>);

    const orders = await prisma.order.count({ where: { guestEmail: email } });
    expect(orders).toBe(0);

    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variantId: variant.id },
    });
    expect(inventory.quantityOnHand).toBe(5);
    expect(inventory.quantityReserved).toBe(0);
  });
});
