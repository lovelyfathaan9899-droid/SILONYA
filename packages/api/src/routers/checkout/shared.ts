import { prisma } from "@silonya/database";
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

/** Zod types optional fields as `X | undefined`; Prisma's generated input wants `X | null` under exactOptionalPropertyTypes — never the literal `undefined`. */
export function toAddressCreateInput(address: AddressFormInput) {
  return {
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    region: address.region ?? null,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    phone: address.phone ?? null,
    userId: null,
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
 * later (ORDER_MANAGEMENT.md §8). `perUserLimit` isn't enforced here: guest
 * checkout has no durable identity to key it on (AUTHENTICATION.md — no
 * customer accounts this phase), so only the global `usageLimit` applies
 * until accounts exist.
 */
export async function validateDiscountCode(
  code: string,
  subtotal: number,
): Promise<ValidatedDiscount> {
  const discount = await prisma.discount.findUnique({ where: { code: code.trim().toUpperCase() } });
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

  return {
    id: discount.id,
    type: discount.type,
    value: discount.value,
    amount: calculateDiscountAmount({ type: discount.type, value: discount.value }, subtotal),
    freeShipping: discount.type === "free_shipping",
  };
}
