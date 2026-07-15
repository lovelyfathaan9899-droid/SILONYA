import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/** SEO_ARCHITECTURE.md §7 — keeps crawl budget on indexable, valuable pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/account", "/search", "/api", "/order", "/orders"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
