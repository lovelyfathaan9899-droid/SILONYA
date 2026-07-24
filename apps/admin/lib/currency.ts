/**
 * Admin-only PKR display formatting. Deliberately separate from
 * packages/utils's formatPriceForDisplay (shared with the storefront,
 * apps/web) — this only changes how money is *displayed inside the admin
 * dashboard*, not the currency actually charged at storefront checkout
 * (packages/api/src/routers/checkout/shared.ts's CURRENCY constant, still
 * "USD" — a live-transaction currency change is a separate, much larger
 * decision than an admin display preference and is out of scope here).
 *
 * All amounts are still stored as integer minor units (cents-equivalent,
 * DATABASE_ARCHITECTURE.md §1) — this only formats them for reading.
 */
export function formatPKR(minorUnits: number): string {
  const amount = Math.round(minorUnits / 100);
  return `${new Intl.NumberFormat("en-US").format(amount)} PKR`;
}
