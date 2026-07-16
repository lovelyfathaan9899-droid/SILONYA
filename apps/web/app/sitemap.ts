import type { MetadataRoute } from "next";
import { createServerCaller } from "@/lib/trpc-caller";
import { SITE_URL } from "@/lib/site-config";
import { featuredCollectionSlugs } from "@/lib/homepage-content";
import { categorySlugs } from "@/lib/taxonomy";

export const revalidate = 3600;

async function getAllProductSlugs(): Promise<string[]> {
  const caller = createServerCaller();
  const slugs: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await caller.catalog.list({ limit: 48, ...(cursor ? { cursor } : {}) });
    slugs.push(...page.items.map((item) => item.slug));
    cursor = page.nextCursor;
  } while (cursor);

  return slugs;
}

/** Dynamically generated from the live catalog (SEO_ARCHITECTURE.md §7) — never a stale static file. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const caller = createServerCaller();
  const [productSlugs, editorialPages, staticPages, lookbooks] = await Promise.all([
    getAllProductSlugs(),
    caller.cms.listPages({ type: "editorial" }),
    caller.cms.listPages({ type: "static_page" }),
    caller.cms.listPages({ type: "lookbook" }),
  ]);

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/lookbooks`, changeFrequency: "weekly", priority: 0.6 },
    ...featuredCollectionSlugs.map((slug) => ({
      url: `${SITE_URL}/collections/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...categorySlugs.map((slug) => ({
      url: `${SITE_URL}/categories/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...productSlugs.map((slug) => ({
      url: `${SITE_URL}/products/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...[...editorialPages, ...staticPages].map((page) => ({
      url: `${SITE_URL}/pages/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...lookbooks.map((page) => ({
      url: `${SITE_URL}/lookbooks/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
