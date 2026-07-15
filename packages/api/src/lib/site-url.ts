/** Shared by any router that needs to build a storefront URL (checkout success/cancel URLs, order-tracking links in emails). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
