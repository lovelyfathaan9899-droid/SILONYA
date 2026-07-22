import { prisma, type Prisma } from "@silonya/database";
import { calculateDiscountAmount, type DiscountKind } from "@silonya/utils";
import { TRPCError } from "@trpc/server";

export const CURRENCY = "USD";

interface AddressFormInput {
  line1: string;
  line2?: string | undefined;
  city: string;
  region?: string | undefined;
  postalCode: string;
  countryCode: string;
  phone?: string | undefined;
}

/** Zod types optional fields as `X | undefined`; Prisma's generated input wants `X | null` under exactOptionalPropertyTypes — never the literal `undefined`. When a customer is logged in, the checkout address is attached to their account so it appears in their saved addresses afterward; guest checkout (userId omitted) keeps it unattached, as before. */
export function toAddressCreateInput(address: AddressFormInput, userId?: string | null) {
  return {
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    region: address.region ?? null,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    phone: address.phone ?? null,
    userId: userId ?? null,
  };
}

export function variantLabel(optionValues: { productOptionValue: { value: string } }[]): string {
  return optionValues.map((ov) => ov.productOptionValue.value).join(" / ");
}

export interface ValidatedDiscount {
  id: string;
  type: DiscountKind;
  value: number;
  amount: number;
  freeShipping: boolean;
}

/**
 * Shared by checkout.createIntent (authoritative, inside the order
 * transaction) and checkout.previewDiscount (live UI feedback on the cart
 * page) — one rule set, never validated in isolation and trusted moments
 * later (ORDER_MANAGEMENT.md §8). `perUserLimit` only applies when a
 * customer is logged in (`userId` given) — guest checkout has no durable
 * identity to key it on, so only the global `usageLimit` applies to guests.
 */
export async function validateDiscountCode(
  code: string,
  subtotal: number,
  userId?: string | null,
): Promise<ValidatedDiscount> {
  const discount = await prisma.discount.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { eligibility: true },
  });
  if (!discount) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That discount code isn't valid." });
  }

  const now = new Date();
  if (discount.startsAt && discount.startsAt > now) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That discount code isn't active yet." });
  }
  if (discount.endsAt && discount.endsAt < now) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That discount code has expired." });
  }
  if (discount.minimumSubtotal && subtotal < discount.minimumSubtotal) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Your order doesn't meet the minimum for this code.",
    });
  }
  // Customer-specific coupons (PROMOTIONS) — any eligibility rows restrict
  // the code to those users; no rows means available to everyone.
  if (discount.eligibility.length > 0) {
    if (!userId || !discount.eligibility.some((e) => e.userId === userId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That discount code isn't valid for your account.",
      });
    }
  }
  if (discount.usageLimit !== null) {
    const redemptions = await prisma.discountRedemption.count({
      where: { discountId: discount.id },
    });
    if (redemptions >= discount.usageLimit) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That discount code has been fully redeemed.",
      });
    }
  }
  if (discount.perUserLimit !== null && userId) {
    const userRedemptions = await prisma.discountRedemption.count({
      where: { discountId: discount.id, userId },
    });
    if (userRedemptions >= discount.perUserLimit) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You've already used this discount code the maximum number of times.",
      });
    }
  }

  return {
    id: discount.id,
    type: discount.type,
    value: discount.value,
    amount: calculateDiscountAmount({ type: discount.type, value: discount.value }, subtotal),
    freeShipping: discount.type === "free_shipping",
  };
}

/**
 * PROMOTIONS — automatic discounts: a code-less Discount is applied without
 * the customer entering anything, provided they're eligible and it's
 * currently active. Non-stacking with a manually entered code (callers only
 * look this up when no discountCode was supplied) and non-stacking with
 * itself — the single best-value eligible automatic discount wins.
 */
export async function findAutomaticDiscount(
  subtotal: number,
  userId?: string | null,
): Promise<ValidatedDiscount | null> {
  const now = new Date();
  const candidates = await prisma.discount.findMany({
    where: {
      code: null,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    include: { eligibility: true },
  });

  let best: ValidatedDiscount | null = null;
  for (const discount of candidates) {
    if (discount.minimumSubtotal && subtotal < discount.minimumSubtotal) continue;
    if (discount.eligibility.length > 0) {
      if (!userId || !discount.eligibility.some((e) => e.userId === userId)) continue;
    }
    if (discount.usageLimit !== null) {
      const redemptions = await prisma.discountRedemption.count({
        where: { discountId: discount.id },
      });
      if (redemptions >= discount.usageLimit) continue;
    }
    if (discount.perUserLimit !== null && userId) {
      const userRedemptions = await prisma.discountRedemption.count({
        where: { discountId: discount.id, userId },
      });
      if (userRedemptions >= discount.perUserLimit) continue;
    }

    const amount = calculateDiscountAmount(
      { type: discount.type, value: discount.value },
      subtotal,
    );
    if (!best || amount > best.amount) {
      best = {
        id: discount.id,
        type: discount.type,
        value: discount.value,
        amount,
        freeShipping: discount.type === "free_shipping",
      };
    }
  }
  return best;
}

/**
 * Re-validates a discount's usage limits atomically, immediately before
 * recording its redemption inside the checkout transaction. validateDiscountCode/
 * findAutomaticDiscount above run on the bare `prisma` client, before the
 * checkout transaction even opens (so the UI can reject a bad/exhausted code
 * fast, without holding a lock) — that's a check-then-act race for a
 * usage-limited code: two concurrent checkouts against the last remaining
 * use can both pass the count check before either writes its
 * DiscountRedemption row, over-redeeming the limit. `SELECT ... FOR UPDATE`
 * locks the Discount row so a second concurrent checkout using the *same*
 * code blocks here until the first commits/rolls back and then sees the
 * up-to-date count — same reasoning as reserveInventory's conditional
 * UPDATE, applied to a row lock since "usage count" is a derived COUNT(*),
 * not a single column that a conditional UPDATE can guard directly.
 */
export async function assertDiscountStillRedeemable(
  tx: Prisma.TransactionClient,
  discountId: string,
  userId?: string | null,
): Promise<void> {
  const rows = await tx.$queryRaw<
    { usage_limit: number | null; per_user_limit: number | null }[]
  >`SELECT usage_limit, per_user_limit FROM discounts WHERE id = ${discountId} FOR UPDATE`;
  const discount = rows[0];
  if (!discount) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That discount code is no longer available.",
    });
  }
  if (discount.usage_limit !== null) {
    const count = await tx.discountRedemption.count({ where: { discountId } });
    if (count >= discount.usage_limit) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That discount code has just been fully redeemed.",
      });
    }
  }
  if (discount.per_user_limit !== null && userId) {
    const count = await tx.discountRedemption.count({ where: { discountId, userId } });
    if (count >= discount.per_user_limit) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You've already used this discount code the maximum number of times.",
      });
    }
  }
}
