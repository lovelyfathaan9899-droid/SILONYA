import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "../generated/client/index.js";

/**
 * Sample customer-facing data (Phase 8+9 — CUSTOMER ACCOUNT SYSTEM /
 * PROMOTIONS) so the storefront's account area, reviews, and gift-card
 * redemption have something real to exercise locally. Idempotent like
 * seed-catalog.ts/seed-discounts.ts — safe to re-run.
 */
export async function seedAccounts(prisma: PrismaClient): Promise<void> {
  const customerEmail = process.env.CUSTOMER_SEED_EMAIL ?? "customer@silonya.com";
  const customerPassword = process.env.CUSTOMER_SEED_PASSWORD ?? "change-me-immediately";

  const passwordHash = await hash(customerPassword, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      passwordHash,
      firstName: "Jordan",
      lastName: "Avery",
      emailVerifiedAt: new Date(),
      marketingOptIn: true,
    },
  });
  console.warn(`Seeded sample customer: ${customerEmail}`);
  if (!process.env.CUSTOMER_SEED_PASSWORD) {
    console.warn(
      'CUSTOMER_SEED_PASSWORD not set — used default "change-me-immediately". Set it in .env and re-seed for a real local password.',
    );
  }

  const product = await prisma.product.findUnique({
    where: { slug: "wool-overcoat" },
    include: { variants: { take: 1, orderBy: { sku: "asc" } } },
  });
  const variant = product?.variants[0];

  if (product && variant) {
    let order = await prisma.order.findFirst({
      where: { userId: customer.id, items: { some: { variantId: variant.id } } },
    });
    if (!order) {
      const address = await prisma.address.create({
        data: {
          userId: customer.id,
          line1: "500 Market Street",
          city: "San Francisco",
          region: "CA",
          postalCode: "94105",
          countryCode: "US",
          isDefault: true,
        },
      });
      order = await prisma.order.create({
        data: {
          orderNumber: `SIL-${String(100000 + Math.floor(Math.random() * 899999))}`,
          userId: customer.id,
          guestEmail: customer.email,
          status: "delivered",
          subtotal: variant.price ?? product.basePrice,
          shippingTotal: 0,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: variant.price ?? product.basePrice,
          shippingAddressId: address.id,
          billingAddressId: address.id,
          placedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          items: {
            create: {
              variantId: variant.id,
              productNameSnapshot: product.name,
              variantLabelSnapshot: "S / Black",
              skuSnapshot: variant.sku,
              unitPrice: variant.price ?? product.basePrice,
              quantity: 1,
              lineTotal: variant.price ?? product.basePrice,
            },
          },
        },
      });
      console.warn(`Seeded sample order ${order.orderNumber} for ${customerEmail}.`);
    }

    const existingReview = await prisma.review.findFirst({
      where: { productId: product.id, userId: customer.id },
    });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          productId: product.id,
          userId: customer.id,
          orderId: order.id,
          rating: 5,
          title: "Exactly as described",
          body: "The wool is heavier than I expected in the best way — this coat has already become my daily layer.",
          status: "published",
        },
      });
      console.warn("Seeded sample review.");
    }
  }

  const giftCardCode = "GC-SAMPLE-0001";
  const existingGiftCard = await prisma.giftCard.findUnique({ where: { code: giftCardCode } });
  if (!existingGiftCard) {
    const giftCard = await prisma.giftCard.create({
      data: {
        code: giftCardCode,
        initialBalance: 10000,
        currentBalance: 10000,
        issuedToEmail: customerEmail,
      },
    });
    // Ledger entry for the initial issuance — analytics/admin gift-card
    // usage reads are transaction-log-driven (adminAnalytics.giftCardUsage),
    // so a gift card created without one would silently undercount.
    await prisma.giftCardTransaction.create({
      data: { giftCardId: giftCard.id, type: "issued", amount: giftCard.initialBalance },
    });
    console.warn(`Seeded sample gift card: ${giftCardCode}.`);
  }

  const customerCouponCode = "VIP15";
  const existingCoupon = await prisma.discount.findUnique({ where: { code: customerCouponCode } });
  if (!existingCoupon) {
    await prisma.discount.create({
      data: {
        code: customerCouponCode,
        type: "percentage",
        value: 15,
        eligibility: { create: { userId: customer.id } },
      },
    });
    console.warn(
      `Seeded sample customer-specific coupon: ${customerCouponCode} (for ${customerEmail}).`,
    );
  }
}
