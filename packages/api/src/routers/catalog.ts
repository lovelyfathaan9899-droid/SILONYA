import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { resolveCategoryIds } from "../lib/category-tree";
import { customerProcedure, publicProcedure, router } from "../trpc";

const SORT = z.enum(["recommended", "newest", "price-asc", "price-desc"]);

const productListInclude = {
  media: { orderBy: { position: "asc" as const }, take: 1 },
  variants: { include: { inventory: true } },
};

/** quantityOnHand - quantityReserved, summed across warehouses (PRODUCT_SYSTEM.md §4.1) — never trusted from a cache, computed fresh on every query. */
function variantAvailable(
  inventory: { quantityOnHand: number; quantityReserved: number }[],
): boolean {
  return inventory.reduce((sum, inv) => sum + (inv.quantityOnHand - inv.quantityReserved), 0) > 0;
}

function toCardSummary(product: {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  currency: string;
  media: { url: string; altText: string }[];
  variants: {
    price: number | null;
    compareAtPrice: number | null;
    inventory: { quantityOnHand: number; quantityReserved: number }[];
  }[];
}) {
  const prices = product.variants.map((v) => v.price ?? product.basePrice);
  const price = prices.length > 0 ? Math.min(...prices) : product.basePrice;
  const compareAtPrice = product.variants.find((v) => v.compareAtPrice)?.compareAtPrice ?? null;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price,
    compareAtPrice,
    currency: product.currency,
    image: product.media[0] ?? null,
    available: product.variants.some((v) => variantAvailable(v.inventory)),
  };
}

function orderByForSort(sort: z.infer<typeof SORT>) {
  switch (sort) {
    case "price-asc":
      return { basePrice: "asc" as const };
    case "price-desc":
      return { basePrice: "desc" as const };
    case "newest":
    case "recommended":
    default:
      // "Recommended" is documented (PRODUCT_SYSTEM.md §7) as a merchandiser
      // -curated per-collection order, which needs a `position` field on
      // ProductCollection that doesn't exist yet — ties to "newest" until
      // that's added (an additive, non-breaking schema change).
      return { publishedAt: "desc" as const };
  }
}

/** Product ids ranked by units sold (completed orders only), optionally windowed — shared by `trending` (30-day window) and `bestSellers` (all-time). Raw SQL: aggregating across three joined tables by summed quantity isn't a single Prisma groupBy. */
async function topSellingProductIds(limit: number, sinceDate?: Date): Promise<string[]> {
  const rows = sinceDate
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE p.status = 'active' AND p.deleted_at IS NULL
          AND o.status NOT IN ('pending_payment', 'payment_failed', 'cancelled')
          AND o.created_at >= ${sinceDate}
        GROUP BY p.id
        ORDER BY SUM(oi.quantity) DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE p.status = 'active' AND p.deleted_at IS NULL
          AND o.status NOT IN ('pending_payment', 'payment_failed', 'cancelled')
        GROUP BY p.id
        ORDER BY SUM(oi.quantity) DESC
        LIMIT ${limit}
      `;
  return rows.map((r) => r.id);
}

async function productsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productListInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(toCardSummary);
}

export const catalogRouter = router({
  list: publicProcedure
    .input(
      z.object({
        categorySlug: z.string().optional(),
        collectionSlug: z.string().optional(),
        search: z.string().trim().min(1).optional(),
        sort: SORT.default("recommended"),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(48).default(24),
      }),
    )
    .query(async ({ input }) => {
      // Resolves to itself + all descendant category ids, so a department
      // slug (e.g. "women") matches products tagged to any of its leaf
      // subcategories, not just products tagged to the bare department
      // (PRODUCT_SYSTEM.md §5 — a product is assigned to exactly one leaf).
      const categoryIds = input.categorySlug
        ? await resolveCategoryIds(input.categorySlug)
        : undefined;

      const where = {
        status: "active" as const,
        deletedAt: null,
        ...(input.categorySlug
          ? { categories: { some: { categoryId: { in: categoryIds ?? [] } } } }
          : {}),
        ...(input.collectionSlug
          ? { collections: { some: { collection: { slug: input.collectionSlug } } } }
          : {}),
        ...(input.search ? { name: { contains: input.search, mode: "insensitive" as const } } : {}),
      };

      const products = await prisma.product.findMany({
        where,
        orderBy: orderByForSort(input.sort),
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: productListInclude,
      });

      const hasMore = products.length > input.limit;
      const items = (hasMore ? products.slice(0, -1) : products).map(toCardSummary);

      return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const product = await prisma.product.findUnique({
      where: { slug: input.slug },
      include: {
        options: {
          orderBy: { position: "asc" },
          include: { values: { orderBy: { position: "asc" } } },
        },
        variants: {
          include: { optionValues: { include: { productOptionValue: true } }, inventory: true },
        },
        media: { orderBy: { position: "asc" } },
        categories: { include: { category: { include: { parent: true } } } },
        collections: { include: { collection: true } },
      },
    });

    if (!product) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This product isn't available." });
    }
    if (product.status !== "active" || product.deletedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This product isn't available." });
    }

    const primaryCategoryId = product.categories[0]?.categoryId;
    const related = primaryCategoryId
      ? await prisma.product.findMany({
          where: {
            status: "active",
            deletedAt: null,
            id: { not: product.id },
            categories: { some: { categoryId: primaryCategoryId } },
          },
          take: 4,
          include: productListInclude,
        })
      : [];

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      basePrice: product.basePrice,
      currency: product.currency,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values.map((v) => ({ id: v.id, value: v.value })),
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: variant.price ?? product.basePrice,
        compareAtPrice: variant.compareAtPrice,
        available: variantAvailable(variant.inventory),
        optionValueIds: variant.optionValues.map((ov) => ov.productOptionValueId),
      })),
      media: product.media.map((m) => ({ url: m.url, altText: m.altText, variantId: m.variantId })),
      category: product.categories[0]?.category
        ? {
            name: product.categories[0].category.name,
            slug: product.categories[0].category.slug,
            parent: product.categories[0].category.parent
              ? {
                  name: product.categories[0].category.parent.name,
                  slug: product.categories[0].category.parent.slug,
                }
              : null,
          }
        : null,
      related: related.map(toCardSummary),
    };
  }),

  getCollectionBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const collection = await prisma.collection.findUnique({ where: { slug: input.slug } });
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
      }
      return collection;
    }),

  getCategoryBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const category = await prisma.category.findUnique({
        where: { slug: input.slug },
        include: { parent: true, children: { orderBy: { name: "asc" } } },
      });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
      }
      return category;
    }),

  /**
   * Postgres ILIKE search — a deliberate placeholder for the Meilisearch
   * architecture in SEARCH_AND_FILTERS.md, which needs infrastructure
   * (index, sync worker) not yet stood up. Good enough for a small launch
   * catalog; swap the query implementation, not this contract, when
   * Meilisearch lands (SEARCH_AND_FILTERS.md §7's provider-agnostic design).
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().trim().min(1),
        limit: z.number().int().min(1).max(20).default(8),
      }),
    )
    .query(async ({ input }) => {
      const products = await prisma.product.findMany({
        where: {
          status: "active",
          deletedAt: null,
          name: { contains: input.query, mode: "insensitive" },
        },
        take: input.limit,
        include: productListInclude,
      });

      return products.map(toCardSummary);
    }),

  /** CUSTOMER EXPERIENCE — trending: most units sold in the last 30 days. Data-driven, additive to (not a replacement for) the curated "best-sellers" Collection already used on the homepage. */
  trending: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).default(8) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return productsByIds(await topSellingProductIds(input.limit, since));
    }),

  /** CUSTOMER EXPERIENCE — best sellers: most units sold all-time, computed from real order data. */
  bestSellers: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).default(8) }))
    .query(async ({ input }) => {
      return productsByIds(await topSellingProductIds(input.limit));
    }),

  /**
   * CUSTOMER EXPERIENCE — "personalized recommendations architecture":
   * products from categories the signed-in customer has previously bought
   * from, excluding what they already own. Falls back to sitewide trending
   * for a customer with no purchase history yet.
   */
  recommended: customerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).default(8) }))
    .query(async ({ ctx, input }) => {
      const purchasedItems = await prisma.orderItem.findMany({
        where: {
          order: {
            userId: ctx.customerSession.userId,
            status: { notIn: ["pending_payment", "payment_failed", "cancelled"] },
          },
        },
        select: { variant: { select: { productId: true } } },
      });
      const purchasedIds = [...new Set(purchasedItems.map((i) => i.variant.productId))];

      if (purchasedIds.length === 0) {
        return productsByIds(await topSellingProductIds(input.limit));
      }

      const categoryLinks = await prisma.productCategory.findMany({
        where: { productId: { in: purchasedIds } },
        select: { categoryId: true },
      });
      const categoryIds = [...new Set(categoryLinks.map((c) => c.categoryId))];

      const products = await prisma.product.findMany({
        where: {
          status: "active",
          deletedAt: null,
          id: { notIn: purchasedIds },
          ...(categoryIds.length > 0
            ? { categories: { some: { categoryId: { in: categoryIds } } } }
            : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: input.limit,
        include: productListInclude,
      });

      if (products.length === 0) {
        return productsByIds(await topSellingProductIds(input.limit));
      }

      return products.map(toCardSummary);
    }),
});
