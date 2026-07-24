/** Human-readable order number (DATABASE_ARCHITECTURE.md §3.5 — e.g. "SIL-483920"). Collisions are astronomically unlikely across 900,000 values; the checkout transaction retries on the rare unique-constraint hit rather than relying on this alone. */
export function generateOrderNumber(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `SIL-${String(digits)}`;
}

/**
 * "Basic" shipping/tax calculation (Phase 6 scope), computed server-side and
 * never trusted from the client. PAYMENT_ARCHITECTURE.md §6 specifies
 * Stripe Tax as the long-term tax mechanism; that requires origin-address/
 * tax-registration setup in the Stripe dashboard that isn't in place yet.
 * Pakistan launch has no configured tax rate at all (no entries below) —
 * calculateTax always returns 0 today, kept only so a future market's rate
 * (or Stripe Tax itself) slots in behind the same call sites without
 * another schema/checkout-flow change.
 *
 * Shipping is two flat-rate tiers rather than one — CHECKOUT_ARCHITECTURE
 * (Pakistan launch): Standard is free above a threshold, Express is a paid
 * speed upgrade regardless of order size (matching how courier-based
 * Pakistani ecommerce shipping is typically sold, unlike a single
 * threshold-based rate).
 */
export type ShippingMethod = "standard" | "express";

const SHIPPING_RATES_MINOR_UNITS: Record<ShippingMethod, number> = {
  standard: 25000, // PKR 250
  express: 50000, // PKR 500
};
const FREE_STANDARD_SHIPPING_THRESHOLD_MINOR_UNITS = 500000; // PKR 5,000
const FLAT_TAX_RATE_BY_COUNTRY: Record<string, number> = {};

export function calculateShipping(
  subtotal: number,
  method: ShippingMethod,
  freeShippingOverride: boolean,
): number {
  if (freeShippingOverride) return 0;
  if (method === "standard" && subtotal >= FREE_STANDARD_SHIPPING_THRESHOLD_MINOR_UNITS) {
    return 0;
  }
  return SHIPPING_RATES_MINOR_UNITS[method];
}

export function calculateTax(taxableAmount: number, countryCode: string): number {
  const rate = FLAT_TAX_RATE_BY_COUNTRY[countryCode.toUpperCase()] ?? 0;
  return Math.round(taxableAmount * rate);
}

export type DiscountKind = "percentage" | "fixed_amount" | "free_shipping";

/** free_shipping discounts return 0 here — they're applied via calculateShipping's freeShippingOverride instead, never as a subtotal deduction. */
export function calculateDiscountAmount(
  discount: { type: DiscountKind; value: number },
  subtotal: number,
): number {
  switch (discount.type) {
    case "percentage":
      return Math.round(subtotal * (discount.value / 100));
    case "fixed_amount":
      return Math.min(discount.value, subtotal);
    case "free_shipping":
      return 0;
  }
}
