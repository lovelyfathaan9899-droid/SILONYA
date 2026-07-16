import { prisma } from "@silonya/database";
import { getMeilisearchClient, isMeilisearchConfigured, PRODUCTS_INDEX } from "../lib/meilisearch";

/** One document per ProductVariant, not per Product (SEARCH_AND_FILTERS.md §2) — filtering (size/color/price) and availability are variant-level concerns. */
export interface ProductSearchDocument {
  id: string;
  productId: string;
  slug: string;
  name: string;
  description: string;
  category: string | null;
  collections: string[];
  color: string | null;
  size: string | null;
  price: number;
  available: boolean;
  imageUrl: string | null;
  publishedAt: number | null;
}

async function buildDocumentsForProduct(productId: string): Promise<ProductSearchDocument[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        include: {
          optionValues: { include: { productOptionValue: { include: { productOption: true } } } },
          inventory: true,
          media: { take: 1, orderBy: { position: "asc" } },
        },
      },
      media: { take: 1, orderBy: { position: "asc" } },
      categories: { include: { category: true } },
      collections: { include: { collection: true } },
    },
  });
  if (!product) return [];
  if (product.status !== "active" || product.deletedAt) return [];

  const category = product.categories[0]?.category.name ?? null;
  const collections = product.collections.map((c) => c.collection.name);

  return product.variants.map((variant) => {
    const color = variant.optionValues.find(
      (ov) => ov.productOptionValue.productOption.name.toLowerCase() === "color",
    )?.productOptionValue.value;
    const size = variant.optionValues.find(
      (ov) => ov.productOptionValue.productOption.name.toLowerCase() === "size",
    )?.productOptionValue.value;
    const available =
      variant.inventory.reduce((sum, inv) => sum + (inv.quantityOnHand - inv.quantityReserved), 0) >
      0;
    const image = variant.media[0] ?? product.media[0] ?? null;

    return {
      id: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description ?? "",
      category,
      collections,
      color: color ?? null,
      size: size ?? null,
      price: variant.price ?? product.basePrice,
      available,
      imageUrl: image?.url ?? null,
      publishedAt: product.publishedAt ? product.publishedAt.getTime() : null,
    };
  });
}

/**
 * Fire-and-forget re-index of one product's variants — called after the
 * Postgres transaction commits (SEARCH_AND_FILTERS.md §3's "asynchronous,
 * not synchronous... publishing a product returns immediately"), never
 * awaited inline in the admin mutation's critical path. No-ops silently
 * when Meilisearch isn't configured, since the ILIKE fallback path
 * (routers/search.ts) doesn't need an index to function.
 */
export async function indexProduct(productId: string): Promise<void> {
  if (!isMeilisearchConfigured()) return;
  try {
    const client = getMeilisearchClient();
    const docs = await buildDocumentsForProduct(productId);
    const index = client.index(PRODUCTS_INDEX);
    if (docs.length > 0) {
      await index.addDocuments(docs, { primaryKey: "id" });
    } else {
      await removeProductFromIndex(productId);
    }
  } catch (err) {
    console.error(`[search-index] failed to index product ${productId}:`, err);
  }
}

export async function removeProductFromIndex(productId: string): Promise<void> {
  if (!isMeilisearchConfigured()) return;
  try {
    const client = getMeilisearchClient();
    await client.index(PRODUCTS_INDEX).deleteDocuments({ filter: `productId = "${productId}"` });
  } catch (err) {
    console.error(`[search-index] failed to remove product ${productId} from index:`, err);
  }
}

/** SEARCH_AND_FILTERS.md §2, §6 — searchable/filterable/sortable attributes, synonyms, typo tolerance. Admin-triggered only, allowed to throw loudly if Meilisearch isn't configured (getMeilisearchClient()'s contract). */
export async function configureProductsIndex(): Promise<void> {
  const client = getMeilisearchClient();
  const index = client.index(PRODUCTS_INDEX);
  await index.updateSettings({
    searchableAttributes: ["name", "description", "category", "collections"],
    filterableAttributes: [
      "category",
      "collections",
      "color",
      "size",
      "price",
      "available",
      "productId",
    ],
    sortableAttributes: ["price", "publishedAt"],
    // One representative variant hit per product in results (SEARCH_AND_FILTERS.md
    // §2's "documents are grouped back to their parent product at query time").
    distinctAttribute: "productId",
    synonyms: {
      jumper: ["sweater"],
      sweater: ["jumper"],
      trousers: ["pants"],
      pants: ["trousers"],
      handbag: ["bag", "purse"],
      purse: ["handbag", "bag"],
    },
    typoTolerance: { enabled: true },
  });
}

/** Full reconciliation reindex (nightly/on-demand) — the index is a cache and must always be rebuildable from Postgres alone (SEARCH_AND_FILTERS.md §3). */
export async function reindexAll(): Promise<{ productsIndexed: number; documentsIndexed: number }> {
  const client = getMeilisearchClient();
  await configureProductsIndex();

  const products = await prisma.product.findMany({
    where: { status: "active", deletedAt: null },
    select: { id: true },
  });

  const index = client.index(PRODUCTS_INDEX);
  await index.deleteAllDocuments();

  let documentsIndexed = 0;
  for (const { id } of products) {
    const docs = await buildDocumentsForProduct(id);
    if (docs.length > 0) {
      await index.addDocuments(docs, { primaryKey: "id" });
      documentsIndexed += docs.length;
    }
  }

  return { productsIndexed: products.length, documentsIndexed };
}
