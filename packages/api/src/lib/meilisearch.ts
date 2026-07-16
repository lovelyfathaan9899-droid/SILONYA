import { MeiliSearch } from "meilisearch";

export const PRODUCTS_INDEX = "products";

/** True whenever a Meilisearch instance is actually reachable-configured — callers use this to fall back to the Postgres ILIKE path (SEARCH_AND_FILTERS.md §1's "deliberate, documented placeholder") rather than throwing, since search is public-facing and must never hard-fail for customers just because infrastructure isn't provisioned yet. */
export function isMeilisearchConfigured(): boolean {
  return !!process.env.MEILISEARCH_HOST && !!process.env.MEILISEARCH_API_KEY;
}

/** Same "throw a clear error until configured" pattern as stripe.ts/media.ts — only for admin-triggered indexing calls, which are allowed to fail loudly (unlike the public search path above). */
export function getMeilisearchClient(): MeiliSearch {
  const host = process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILISEARCH_API_KEY;
  if (!host || !apiKey) {
    throw new Error("Search indexing isn't configured yet (missing Meilisearch credentials).");
  }
  return new MeiliSearch({ host, apiKey });
}
