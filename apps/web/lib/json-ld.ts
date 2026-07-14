import { SITE_URL } from "./site-config";

/** Escapes `<` so embedded copy (product names/descriptions) can never break out of the `<script>` tag — JSON.stringify alone doesn't guard against a literal `</script>` in the data. */
export function toJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** SEO_ARCHITECTURE.md §3 — every PDP/PLP carries a BreadcrumbList matching the visible Breadcrumbs trail exactly (same data, never a separate driftable source). */
export function breadcrumbListJsonLd(items: { label: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: new URL(item.href, SITE_URL).toString() } : {}),
    })),
  };
}
