/**
 * Server Components render on Vercel (UTC), not in the customer's browser —
 * dates formatted with no explicit `timeZone` there silently show UTC
 * instead of the customer's local time. Pakistan is currently this app's
 * only market (CHECKOUT_ARCHITECTURE — Pakistan launch), so order/status
 * timestamps are always shown in Asia/Karachi rather than the render
 * environment's ambient timezone.
 */
export function formatDateInKarachi(
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Asia/Karachi" }).format(date);
}
