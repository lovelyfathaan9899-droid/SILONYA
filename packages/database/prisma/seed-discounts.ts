import type { PrismaClient } from "../generated/client/index.js";

/** Test discount codes (Phase 6 — "basic coupon support") so checkout has something real to exercise locally. */
const DISCOUNTS = [
  { code: "WELCOME10", type: "percentage" as const, value: 10 },
  { code: "FREESHIP", type: "free_shipping" as const, value: 0 },
];

export async function seedDiscounts(prisma: PrismaClient): Promise<void> {
  for (const discount of DISCOUNTS) {
    await prisma.discount.upsert({
      where: { code: discount.code },
      update: {},
      create: discount,
    });
  }
  console.warn(
    `Seeded ${String(DISCOUNTS.length)} test discount codes: ${DISCOUNTS.map((d) => d.code).join(", ")}.`,
  );
}
