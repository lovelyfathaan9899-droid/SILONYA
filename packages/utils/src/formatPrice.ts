/**
 * Money is always stored/transmitted as integer minor units (cents) —
 * DATABASE_ARCHITECTURE.md §1, "no float/decimal rounding ambiguity is
 * allowed anywhere." These are the only two places a dollar-and-cents
 * string should ever be parsed from or formatted to.
 */

export function formatPriceForDisplay(minorUnits: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(minorUnits / 100);
}

/**
 * Parses admin-entered text (e.g. "420", "420.5", "$420.00") into integer
 * cents. Returns null for empty/invalid input rather than throwing — the
 * caller (a Zod schema or form validator) decides how to surface that.
 */
export function parsePriceToMinorUnits(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;

  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value) || value < 0) return null;

  return Math.round(value * 100);
}
