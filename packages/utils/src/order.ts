/** Human-readable order number (DATABASE_ARCHITECTURE.md §3.5 — e.g. "SIL-483920"). Collisions are astronomically unlikely across 900,000 values; the checkout transaction retries on the rare unique-constraint hit rather than relying on this alone. */
export function generateOrderNumber(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `SIL-${String(digits)}`;
}

/**
 * "Basic" shipping/tax calculation (Phase 6 scope) — a flat rate and a
 * single-country flat tax rate, computed server-side and never trusted from
 * the client. PAYMENT_ARCHITECTURE.md §6 specifies Stripe Tax as the
 * long-term mechanism; that requires origin-address/tax-registration setup
 * in the Stripe dashboard that isn't in place yet, so this stands in until
 * then — swap the implementation behind these two functions, not their call
 * sites, when Stripe Tax is configured.
 */
const FLAT_SHIPPING_MINOR_UNITS = 1000; // $10.00
const FREE_SHIPPING_THRESHOLD_MINOR_UNITS = 20000; // $200.00
const FLAT_TAX_RATE_BY_COUNTRY: Record<string, number> = { US: 0.08 };

export function calculateShipping(subtotal: number, freeShippingOverride: boolean): number {
  if (freeShippingOverride) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD_MINOR_UNITS ? 0 : FLAT_SHIPPING_MINOR_UNITS;
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
