import type { PrismaClient } from "../generated/client/index.js";

/**
 * Realistic-but-fake catalog (TESTING_STRATEGY.md §10) so the storefront
 * (ROADMAP.md storefront-UI phase) has real data to render locally.
 * Placeholder imagery only — no Cloudinary account is required to seed or
 * view this data, since it points at placehold.co rather than real product
 * photography (DESIGN_SYSTEM.md §2.4 governs the *real* imagery standard,
 * which this intentionally does not attempt to satisfy).
 */

interface SeedVariant {
  sku: string;
  optionValues: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  quantityOnHand: number;
}

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  categorySlug: string;
  collectionSlugs: string[];
  options: { name: string; values: string[] }[];
  variants: SeedVariant[];
  imageCount: number;
}

const CATEGORIES = [
  { name: "Women", slug: "women" },
  { name: "Men", slug: "men" },
];

const COLLECTIONS = [
  { name: "New Arrivals", slug: "new-arrivals", description: "Just landed." },
  {
    name: "Best Sellers",
    slug: "best-sellers",
    description: "The pieces our customers return for.",
  },
  {
    name: "The Essentials",
    slug: "the-essentials",
    description: "Considered basics, done properly.",
  },
];

const SIZE_OPTION = { name: "Size", values: ["XS", "S", "M", "L", "XL"] };
const COLOR = (values: string[]) => ({ name: "Color", values });

const PRODUCTS: SeedProduct[] = [
  {
    name: "Wool Overcoat",
    slug: "wool-overcoat",
    description:
      "A considered layer for the transitional season, cut from double-faced wool with a clean, undecorated silhouette.",
    basePrice: 42000,
    categorySlug: "women",
    collectionSlugs: ["new-arrivals", "best-sellers"],
    options: [SIZE_OPTION, COLOR(["Black", "Camel"])],
    variants: [
      { sku: "WOC-BLK-S", optionValues: { Size: "S", Color: "Black" }, quantityOnHand: 6 },
      { sku: "WOC-BLK-M", optionValues: { Size: "M", Color: "Black" }, quantityOnHand: 4 },
      { sku: "WOC-CML-S", optionValues: { Size: "S", Color: "Camel" }, quantityOnHand: 0 },
      { sku: "WOC-CML-M", optionValues: { Size: "M", Color: "Camel" }, quantityOnHand: 3 },
    ],
    imageCount: 3,
  },
  {
    name: "Silk Slip Dress",
    slug: "silk-slip-dress",
    description:
      "Bias-cut silk that moves with the body. Worn alone in summer, layered the rest of the year.",
    basePrice: 28000,
    categorySlug: "women",
    collectionSlugs: ["new-arrivals"],
    options: [SIZE_OPTION, COLOR(["Ink", "Bone"])],
    variants: [
      { sku: "SSD-INK-XS", optionValues: { Size: "XS", Color: "Ink" }, quantityOnHand: 5 },
      { sku: "SSD-INK-S", optionValues: { Size: "S", Color: "Ink" }, quantityOnHand: 8 },
      { sku: "SSD-BON-S", optionValues: { Size: "S", Color: "Bone" }, quantityOnHand: 2 },
    ],
    imageCount: 2,
  },
  {
    name: "Merino Turtleneck",
    slug: "merino-turtleneck",
    description:
      "Fine-gauge merino, closely knit for warmth without bulk. A quiet foundation piece.",
    basePrice: 16000,
    categorySlug: "women",
    collectionSlugs: ["the-essentials", "best-sellers"],
    options: [SIZE_OPTION, COLOR(["Black", "Stone", "Bone"])],
    variants: [
      { sku: "MTN-BLK-S", optionValues: { Size: "S", Color: "Black" }, quantityOnHand: 12 },
      { sku: "MTN-BLK-M", optionValues: { Size: "M", Color: "Black" }, quantityOnHand: 9 },
      { sku: "MTN-STN-M", optionValues: { Size: "M", Color: "Stone" }, quantityOnHand: 7 },
      { sku: "MTN-BON-L", optionValues: { Size: "L", Color: "Bone" }, quantityOnHand: 4 },
    ],
    imageCount: 2,
  },
  {
    name: "Tailored Trousers",
    slug: "tailored-trousers",
    description:
      "A straight leg with a considered break, cut from a heavyweight wool suiting cloth.",
    basePrice: 24000,
    categorySlug: "women",
    collectionSlugs: ["the-essentials"],
    options: [SIZE_OPTION, COLOR(["Black"])],
    variants: [
      { sku: "TTR-BLK-S", optionValues: { Size: "S", Color: "Black" }, quantityOnHand: 6 },
      { sku: "TTR-BLK-M", optionValues: { Size: "M", Color: "Black" }, quantityOnHand: 6 },
      { sku: "TTR-BLK-L", optionValues: { Size: "L", Color: "Black" }, quantityOnHand: 3 },
    ],
    imageCount: 2,
  },
  {
    name: "Cotton Oxford Shirt",
    slug: "cotton-oxford-shirt",
    description:
      "A dense, long-staple cotton oxford with a soft, unfused collar. Holds its shape wash after wash.",
    basePrice: 14000,
    categorySlug: "men",
    collectionSlugs: ["the-essentials", "best-sellers"],
    options: [SIZE_OPTION, COLOR(["White", "Blue"])],
    variants: [
      { sku: "COS-WHT-M", optionValues: { Size: "M", Color: "White" }, quantityOnHand: 14 },
      { sku: "COS-WHT-L", optionValues: { Size: "L", Color: "White" }, quantityOnHand: 10 },
      { sku: "COS-BLU-M", optionValues: { Size: "M", Color: "Blue" }, quantityOnHand: 8 },
      { sku: "COS-BLU-L", optionValues: { Size: "L", Color: "Blue" }, quantityOnHand: 0 },
    ],
    imageCount: 2,
  },
  {
    name: "Wool Blazer",
    slug: "wool-blazer",
    description:
      "An unstructured blazer in a fine wool twill, soft-shouldered and lightly canvassed.",
    basePrice: 38000,
    categorySlug: "men",
    collectionSlugs: ["new-arrivals"],
    options: [SIZE_OPTION, COLOR(["Charcoal", "Camel"])],
    variants: [
      { sku: "WBL-CHR-M", optionValues: { Size: "M", Color: "Charcoal" }, quantityOnHand: 5 },
      { sku: "WBL-CHR-L", optionValues: { Size: "L", Color: "Charcoal" }, quantityOnHand: 4 },
      { sku: "WBL-CML-L", optionValues: { Size: "L", Color: "Camel" }, quantityOnHand: 2 },
    ],
    imageCount: 3,
  },
  {
    name: "Merino Crew Sweater",
    slug: "merino-crew-sweater",
    description: "A midweight merino crew, fully fashioned for a clean line at the seams.",
    basePrice: 18000,
    categorySlug: "men",
    collectionSlugs: ["best-sellers"],
    options: [SIZE_OPTION, COLOR(["Navy", "Stone"])],
    variants: [
      { sku: "MCS-NVY-M", optionValues: { Size: "M", Color: "Navy" }, quantityOnHand: 11 },
      {
        sku: "MCS-NVY-L",
        optionValues: { Size: "L", Color: "Navy" },
        quantityOnHand: 7,
        compareAtPrice: 22000,
      },
      { sku: "MCS-STN-M", optionValues: { Size: "M", Color: "Stone" }, quantityOnHand: 6 },
    ],
    imageCount: 2,
  },
  {
    name: "Selvedge Denim Jeans",
    slug: "selvedge-denim-jeans",
    description:
      "13oz Japanese selvedge, straight through the leg, left raw for the wearer to break in.",
    basePrice: 22000,
    categorySlug: "men",
    collectionSlugs: ["the-essentials", "new-arrivals"],
    options: [SIZE_OPTION, COLOR(["Indigo"])],
    variants: [
      { sku: "SDJ-IND-S", optionValues: { Size: "S", Color: "Indigo" }, quantityOnHand: 9 },
      { sku: "SDJ-IND-M", optionValues: { Size: "M", Color: "Indigo" }, quantityOnHand: 12 },
      { sku: "SDJ-IND-L", optionValues: { Size: "L", Color: "Indigo" }, quantityOnHand: 5 },
    ],
    imageCount: 2,
  },
];

function placeholderImageUrl(seed: string, index: number): string {
  return `https://placehold.co/1200x1500/e7e4de/111111?text=${encodeURIComponent(seed)}+${String(index + 1)}`;
}

/** Looks up a value seeded earlier in this same run — a miss means the static PRODUCTS data references a slug that doesn't exist in CATEGORIES/COLLECTIONS/options, a bug in the seed data itself. */
function mustGet<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Seed data inconsistency: no value for key "${String(key)}".`);
  }
  return value;
}

export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  const collectionIdBySlug = new Map<string, string>();
  for (const collection of COLLECTIONS) {
    const row = await prisma.collection.upsert({
      where: { slug: collection.slug },
      update: {},
      create: collection,
    });
    collectionIdBySlug.set(collection.slug, row.id);
  }

  const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { isDefault: true } });

  let createdCount = 0;
  for (const seedProduct of PRODUCTS) {
    const exists = await prisma.product.findUnique({ where: { slug: seedProduct.slug } });
    if (exists) continue;

    const product = await prisma.product.create({
      data: {
        name: seedProduct.name,
        slug: seedProduct.slug,
        description: seedProduct.description,
        basePrice: seedProduct.basePrice,
        status: "active",
        publishedAt: new Date(),
        categories: {
          create: [{ categoryId: mustGet(categoryIdBySlug, seedProduct.categorySlug) }],
        },
        collections: {
          create: seedProduct.collectionSlugs.map((slug) => ({
            collectionId: mustGet(collectionIdBySlug, slug),
          })),
        },
        media: {
          create: Array.from({ length: seedProduct.imageCount }, (_, i) => ({
            url: placeholderImageUrl(seedProduct.name, i),
            altText: `${seedProduct.name} — product photo ${String(i + 1)}`,
            position: i,
          })),
        },
      },
    });

    const optionValueIdByName = new Map<string, string>();
    for (const [optionIndex, option] of seedProduct.options.entries()) {
      const createdOption = await prisma.productOption.create({
        data: {
          productId: product.id,
          name: option.name,
          position: optionIndex,
          values: {
            create: option.values.map((value, valueIndex) => ({ value, position: valueIndex })),
          },
        },
        include: { values: true },
      });
      for (const value of createdOption.values) {
        optionValueIdByName.set(`${option.name}:${value.value}`, value.id);
      }
    }

    for (const seedVariant of seedProduct.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: seedVariant.sku,
          price: seedVariant.price ?? null,
          compareAtPrice: seedVariant.compareAtPrice ?? null,
          optionValues: {
            create: Object.entries(seedVariant.optionValues).map(([optionName, value]) => ({
              productOptionValueId: mustGet(optionValueIdByName, `${optionName}:${value}`),
            })),
          },
        },
      });

      await prisma.inventory.create({
        data: {
          variantId: variant.id,
          warehouseId: warehouse.id,
          quantityOnHand: seedVariant.quantityOnHand,
        },
      });
    }

    createdCount += 1;
  }

  console.warn(
    `Seeded ${String(createdCount)} new catalog products (${String(PRODUCTS.length - createdCount)} already existed).`,
  );
}
