import { prisma } from "@silonya/database";
import { z } from "zod";
import { resolveCategoryIds } from "../lib/category-tree";
import { getMeilisearchClient, isMeilisearchConfigured, PRODUCTS_INDEX } from "../lib/meilisearch";
import { publicProcedure, router } from "../trpc";
import type { ProductSearchDocument } from "../services/search-index";

const SORT = z.enum(["relevance", "newest", "price-asc", "price-desc"]);

const searchInput = z.object({
  q: z.string().trim().max(200).default(""),
  category: z.string().trim().optional(),
  collection: z.string().trim().optional(),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  priceMin: z.number().int().min(0).optional(),
  priceMax: z.number().int().min(0).optional(),
  availableOnly: z.boolean().default(false),
  sort: SORT.default("relevance"),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(48).default(24),
});

export interface SearchResultItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  image: { url: string; altText: string } | null;
  available: boolean;
  /** Populated on the Postgres path; the Meilisearch document schema (search-index.ts) doesn't carry it yet, so this is always null on that path until it's added there too. */
  compareAtPrice: number | null;
}

export interface FacetCounts {
  category: Record<string, number>;
  collections: Record<string, number>;
  color: Record<string, number>;
  size: Record<string, number>;
}

function escapeFilterValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

async function searchViaMeilisearch(input: z.infer<typeof searchInput>) {
  const client = getMeilisearchClient();
  const index = client.index(PRODUCTS_INDEX);

  const filters: string[] = [];
  if (input.availableOnly) filters.push("available = true");
  if (input.category) filters.push(`category = "${escapeFilterValue(input.category)}"`);
  if (input.collection) filters.push(`collections = "${escapeFilterValue(input.collection)}"`);
  if (input.color) filters.push(`color = "${escapeFilterValue(input.color)}"`);
  if (input.size) filters.push(`size = "${escapeFilterValue(input.size)}"`);
  if (input.priceMin !== undefined) filters.push(`price >= ${String(input.priceMin)}`);
  if (input.priceMax !== undefined) filters.push(`price <= ${String(input.priceMax)}`);

  const sortMap: Record<string, string[] | undefined> = {
    relevance: undefined,
    newest: ["publishedAt:desc"],
    "price-asc": ["price:asc"],
    "price-desc": ["price:desc"],
  };

  const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;

  const sort = sortMap[input.sort];
  const result = await index.search<ProductSearchDocument>(input.q, {
    facets: ["category", "collections", "color", "size"],
    offset,
    limit: input.limit,
    ...(filters.length > 0 ? { filter: filters.join(" AND ") } : {}),
    ...(sort ? { sort } : {}),
  });

  const items: SearchResultItem[] = result.hits.map((hit) => ({
    id: hit.productId,
    slug: hit.slug,
    name: hit.name,
    price: hit.price,
    currency: "USD",
    image: hit.imageUrl ? { url: hit.imageUrl, altText: hit.name } : null,
    available: hit.available,
    compareAtPrice: null,
  }));

  const facetDistribution = result.facetDistribution as
    | {
        category?: Record<string, number>;
        collections?: Record<string, number>;
        color?: Record<string, number>;
        size?: Record<string, number>;
      }
    | undefined;

  const facets: FacetCounts = {
    category: facetDistribution?.category ?? {},
    collections: facetDistribution?.collections ?? {},
    color: facetDistribution?.color ?? {},
    size: facetDistribution?.size ?? {},
  };

  const nextOffset = offset + input.limit;
  const hasMore = nextOffset < result.estimatedTotalHits;

  return {
    items,
    facets,
    nextCursor: hasMore ? String(nextOffset) : undefined,
    totalHits: result.estimatedTotalHits,
  };
}

const productListInclude = {
  media: { orderBy: { position: "asc" as const }, take: 1 },
  variants: {
    include: {
      inventory: true,
      optionValues: { include: { productOptionValue: { include: { productOption: true } } } },
    },
  },
  categories: { include: { category: true } },
  collections: { include: { collection: true } },
};

function variantAvailable(
  inventory: { quantityOnHand: number; quantityReserved: number }[],
): boolean {
  return inventory.reduce((sum, inv) => sum + (inv.quantityOnHand - inv.quantityReserved), 0) > 0;
}

/**
 * Postgres ILIKE fallback (SEARCH_AND_FILTERS.md §1's documented
 * placeholder) — supports the same filter set as the Meilisearch path so
 * `apps/web` never has to branch on which backend answered. Facet counts
 * here reflect the *current* filtered result set rather than "counts as if
 * this dimension weren't applied" (Meilisearch's more refined behavior) —
 * an intentional simplification for the placeholder path.
 */
async function searchViaPostgres(input: z.infer<typeof searchInput>) {
  // Descendant-aware, matching catalog.ts's `list` — a department slug
  // matches products tagged to any of its leaf subcategories.
  const categoryIds = input.category ? await resolveCategoryIds(input.category) : undefined;

  const where = {
    status: "active" as const,
    deletedAt: null,
    ...(input.q ? { name: { contains: input.q, mode: "insensitive" as const } } : {}),
    ...(input.category ? { categories: { some: { categoryId: { in: categoryIds ?? [] } } } } : {}),
    ...(input.collection
      ? { collections: { some: { collection: { slug: input.collection } } } }
      : {}),
  };

  const products = await prisma.product.findMany({ where, include: productListInclude });

  const filtered = products.filter((product) => {
    const matchingVariants = product.variants.filter((variant) => {
      const color = variant.optionValues.find(
        (ov) => ov.productOptionValue.productOption.name.toLowerCase() === "color",
      )?.productOptionValue.value;
      const size = variant.optionValues.find(
        (ov) => ov.productOptionValue.productOption.name.toLowerCase() === "size",
      )?.productOptionValue.value;
      const price = variant.price ?? product.basePrice;
      const available = variantAvailable(variant.inventory);

      if (input.color && color !== input.color) return false;
      if (input.size && size !== input.size) return false;
      if (input.priceMin !== undefined && price < input.priceMin) return false;
      if (input.priceMax !== undefined && price > input.priceMax) return false;
      if (input.availableOnly && !available) return false;
      return true;
    });
    return matchingVariants.length > 0;
  });

  const facets: FacetCounts = { category: {}, collections: {}, color: {}, size: {} };
  for (const product of filtered) {
    for (const c of product.categories) {
      facets.category[c.category.name] = (facets.category[c.category.name] ?? 0) + 1;
    }
    for (const c of product.collections) {
      facets.collections[c.collection.name] = (facets.collections[c.collection.name] ?? 0) + 1;
    }
    for (const variant of product.variants) {
      const color = variant.optionValues.find(
        (ov) => ov.productOptionValue.productOption.name.toLowerCase() === "color",
      )?.productOptionValue.value;
      const size = variant.optionValues.find(
        (ov) => ov.productOptionValue.productOption.name.toLowerCase() === "size",
      )?.productOptionValue.value;
      if (color) facets.color[color] = (facets.color[color] ?? 0) + 1;
      if (size) facets.size[size] = (facets.size[size] ?? 0) + 1;
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    if (input.sort === "newest") {
      return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    }
    if (input.sort === "price-asc" || input.sort === "price-desc") {
      const aPrice = Math.min(...a.variants.map((v) => v.price ?? a.basePrice));
      const bPrice = Math.min(...b.variants.map((v) => v.price ?? b.basePrice));
      return input.sort === "price-asc" ? aPrice - bPrice : bPrice - aPrice;
    }
    return 0;
  });

  const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
  const page = sorted.slice(offset, offset + input.limit);
  const hasMore = offset + input.limit < sorted.length;

  const items: SearchResultItem[] = page.map((product) => {
    const prices = product.variants.map((v) => v.price ?? product.basePrice);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: prices.length > 0 ? Math.min(...prices) : product.basePrice,
      currency: product.currency,
      image: product.media[0] ?? null,
      available: product.variants.some((v) => variantAvailable(v.inventory)),
      compareAtPrice: product.variants.find((v) => v.compareAtPrice)?.compareAtPrice ?? null,
    };
  });

  return {
    items,
    facets,
    nextCursor: hasMore ? String(offset + input.limit) : undefined,
    totalHits: sorted.length,
  };
}

async function logSearchQuery(query: string, resultCount: number): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;
  await prisma.searchQueryLog
    .create({ data: { query: trimmed.toLowerCase(), resultCount } })
    .catch((err: unknown) => {
      console.error("[search] failed to log search query:", err);
    });
}

/** SEARCH_AND_FILTERS.md — full-text search, faceted filtering, autocomplete, popular searches. Uses Meilisearch when configured, otherwise the documented Postgres ILIKE placeholder — same contract either way. */
export const searchRouter = router({
  query: publicProcedure.input(searchInput).query(async ({ input }) => {
    const result = isMeilisearchConfigured()
      ? await searchViaMeilisearch(input).catch(async (err: unknown) => {
          console.error("[search] Meilisearch query failed, falling back to Postgres:", err);
          return searchViaPostgres(input);
        })
      : await searchViaPostgres(input);

    await logSearchQuery(input.q, result.totalHits);
    return result;
  }),

  /** Lightweight, debounced-on-the-client autocomplete — small limit, no facets, not logged (keystroke-level noise). */
  autocomplete: publicProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(10).default(6),
      }),
    )
    .query(async ({ input }) => {
      if (isMeilisearchConfigured()) {
        try {
          const client = getMeilisearchClient();
          const result = await client.index(PRODUCTS_INDEX).search<ProductSearchDocument>(input.q, {
            filter: "available = true",
            limit: input.limit,
          });
          return result.hits.map((hit) => ({
            slug: hit.slug,
            name: hit.name,
            image: hit.imageUrl,
          }));
        } catch (err) {
          console.error("[search] Meilisearch autocomplete failed, falling back to Postgres:", err);
        }
      }

      const products = await prisma.product.findMany({
        where: {
          status: "active",
          deletedAt: null,
          name: { contains: input.q, mode: "insensitive" },
        },
        take: input.limit,
        include: { media: { take: 1, orderBy: { position: "asc" } } },
      });
      return products.map((p) => ({ slug: p.slug, name: p.name, image: p.media[0]?.url ?? null }));
    }),

  /** No PII (SEARCH_AND_FILTERS.md §8) — aggregated query text + counts only, last 30 days. */
  popular: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await prisma.searchQueryLog.groupBy({
        by: ["query"],
        where: { createdAt: { gte: since }, resultCount: { gt: 0 } },
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: input.limit,
      });
      return rows.map((row) => ({ query: row.query, count: row._count.query }));
    }),
});
