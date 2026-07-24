/**
 * Admin-only PKR display formatting, using the "X,XXX PKR" suffix style
 * favored in the admin dashboard. Deliberately separate from
 * packages/utils's formatPriceForDisplay (shared with the storefront,
 * apps/web, which uses the "PKR X,XXX" prefix style via Intl) — the two
 * are intentionally different presentations of the same PKR amounts, not a
 * currency mismatch; storefront checkout also charges PKR
 * (packages/api/src/routers/checkout/shared.ts's CURRENCY constant).
 *
 * All amounts are still stored as integer minor units (paisa-equivalent,
 * DATABASE_ARCHITECTURE.md §1) — this only formats them for reading.
 */
export function formatPKR(minorUnits: number): string {
  const amount = Math.round(minorUnits / 100);
  return `${new Intl.NumberFormat("en-US").format(amount)} PKR`;
}
