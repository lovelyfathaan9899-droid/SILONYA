import type { PrismaClient } from "@prisma/client";

/**
 * Realistic-but-fake catalog (TESTING_STRATEGY.md §10) so the storefront
 * (ROADMAP.md storefront-UI phase) has real data to render locally.
 * Placeholder imagery only — no Cloudinary account is required to seed or
 * view this data, since it points at placehold.co rather than real product
 * photography (DESIGN_SYSTEM.md §2.4 governs the *real* imagery standard,
 * which this intentionally does not attempt to satisfy).
 *
 * Category tree (PRODUCT_SYSTEM.md §5 — "Hierarchical tree"): five
 * top-level departments, each with several leaf subcategories. Every
 * product is assigned to exactly one leaf category (never the bare
 * department), matching "category assignment is treated as effectively
 * single-select" in that doc. Leaf slugs are department-prefixed
 * (`women-dresses`, not `dresses`) so no two leaves can ever collide, even
 * though today only "Shoes" (Women/Men) actually would.
 *
 * Perfume's leaves are segmented by gender (Women's/Men's/Unisex Perfume)
 * rather than by product type — the same segmentation a dedicated "Gender"
 * facet would otherwise provide, modeled as taxonomy instead of a new facet
 * dimension so browsing/filtering/PDP all work exactly like every other
 * department (Volume/Concentration are ProductOptions on the variant, same
 * mechanism as Size/Color).
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

const DEPARTMENTS = [
  { name: "Women", slug: "women" },
  { name: "Men", slug: "men" },
  { name: "Kids", slug: "kids" },
  { name: "Perfume", slug: "perfume" },
  { name: "Accessories", slug: "accessories" },
] as const;

const SUBCATEGORIES: { name: string; slug: string; departmentSlug: string }[] = [
  { name: "Dresses", slug: "women-dresses", departmentSlug: "women" },
  { name: "Tops", slug: "women-tops", departmentSlug: "women" },
  { name: "Bottoms", slug: "women-bottoms", departmentSlug: "women" },
  { name: "Outerwear", slug: "women-outerwear", departmentSlug: "women" },
  { name: "Shoes", slug: "women-shoes", departmentSlug: "women" },
  { name: "Shirts", slug: "men-shirts", departmentSlug: "men" },
  { name: "T-Shirts", slug: "men-t-shirts", departmentSlug: "men" },
  { name: "Pants", slug: "men-pants", departmentSlug: "men" },
  { name: "Jackets", slug: "men-jackets", departmentSlug: "men" },
  { name: "Shoes", slug: "men-shoes", departmentSlug: "men" },
  { name: "Baby", slug: "kids-baby", departmentSlug: "kids" },
  { name: "Boys", slug: "kids-boys", departmentSlug: "kids" },
  { name: "Girls", slug: "kids-girls", departmentSlug: "kids" },
  { name: "Women's Perfume", slug: "perfume-women", departmentSlug: "perfume" },
  { name: "Men's Perfume", slug: "perfume-men", departmentSlug: "perfume" },
  { name: "Unisex Perfume", slug: "perfume-unisex", departmentSlug: "perfume" },
  { name: "Bags", slug: "accessories-bags", departmentSlug: "accessories" },
  { name: "Wallets", slug: "accessories-wallets", departmentSlug: "accessories" },
  { name: "Belts", slug: "accessories-belts", departmentSlug: "accessories" },
  { name: "Caps", slug: "accessories-caps", departmentSlug: "accessories" },
  { name: "Sunglasses", slug: "accessories-sunglasses", departmentSlug: "accessories" },
  { name: "Watches", slug: "accessories-watches", departmentSlug: "accessories" },
  { name: "Jewellery", slug: "accessories-jewellery", departmentSlug: "accessories" },
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
  { name: "Sale", slug: "sale", description: "Reduced prices, while stocks last." },
];

const SIZE_OPTION = { name: "Size", values: ["XS", "S", "M", "L", "XL"] };
const SHOE_SIZE = (values: string[]) => ({ name: "Size", values });
const BABY_SIZE = { name: "Size", values: ["0-3M", "3-6M", "6-12M"] };
const KIDS_SIZE = { name: "Size", values: ["2-3Y", "4-5Y", "6-7Y"] };
const BELT_SIZE = { name: "Size", values: ["S", "M", "L", "XL"] };
const COLOR = (values: string[]) => ({ name: "Color", values });

const PRODUCTS: SeedProduct[] = [
  // ── Existing products, remapped to leaf categories (PRODUCT_SYSTEM.md §5) ──
  {
    name: "Wool Overcoat",
    slug: "wool-overcoat",
    description:
      "A considered layer for the transitional season, cut from double-faced wool with a clean, undecorated silhouette.",
    basePrice: 42000,
    categorySlug: "women-outerwear",
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
    categorySlug: "women-dresses",
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
    categorySlug: "women-tops",
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
    categorySlug: "women-bottoms",
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
    categorySlug: "men-shirts",
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
    categorySlug: "men-jackets",
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
    // No dedicated knitwear leaf exists in the required Men taxonomy
    // (Shirts/T-Shirts/Pants/Jackets/Shoes) — T-Shirts is the closest fit
    // for a general upper-body knit.
    categorySlug: "men-t-shirts",
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
    categorySlug: "men-pants",
    collectionSlugs: ["the-essentials", "new-arrivals"],
    options: [SIZE_OPTION, COLOR(["Indigo"])],
    variants: [
      { sku: "SDJ-IND-S", optionValues: { Size: "S", Color: "Indigo" }, quantityOnHand: 9 },
      { sku: "SDJ-IND-M", optionValues: { Size: "M", Color: "Indigo" }, quantityOnHand: 12 },
      { sku: "SDJ-IND-L", optionValues: { Size: "L", Color: "Indigo" }, quantityOnHand: 5 },
    ],
    imageCount: 2,
  },

  // ── Women — Shoes ──
  {
    name: "Leather Ankle Boots",
    slug: "leather-ankle-boots",
    description:
      "A round-toe boot in vegetable-tanned leather, finished with a low block heel for all-day wear.",
    basePrice: 32000,
    categorySlug: "women-shoes",
    collectionSlugs: ["new-arrivals"],
    options: [SHOE_SIZE(["36", "37", "38", "39", "40"]), COLOR(["Black", "Cognac"])],
    variants: [
      { sku: "LAB-BLK-37", optionValues: { Size: "37", Color: "Black" }, quantityOnHand: 5 },
      { sku: "LAB-BLK-38", optionValues: { Size: "38", Color: "Black" }, quantityOnHand: 6 },
      { sku: "LAB-CGN-38", optionValues: { Size: "38", Color: "Cognac" }, quantityOnHand: 3 },
    ],
    imageCount: 2,
  },
  {
    name: "Suede Block-Heel Pumps",
    slug: "suede-block-heel-pumps",
    description:
      "A closed pump in brushed suede, cut with a comfortable block heel rather than a stiletto.",
    basePrice: 29000,
    categorySlug: "women-shoes",
    collectionSlugs: ["the-essentials"],
    options: [SHOE_SIZE(["36", "37", "38", "39"]), COLOR(["Black", "Dune"])],
    variants: [
      { sku: "SBP-BLK-37", optionValues: { Size: "37", Color: "Black" }, quantityOnHand: 4 },
      { sku: "SBP-DUN-38", optionValues: { Size: "38", Color: "Dune" }, quantityOnHand: 5 },
    ],
    imageCount: 2,
  },

  // ── Men — Shoes ──
  {
    name: "Leather Derby Shoes",
    slug: "leather-derby-shoes",
    description:
      "A classic derby in full-grain calfskin, Goodyear-welted for resoling rather than replacement.",
    basePrice: 34000,
    categorySlug: "men-shoes",
    collectionSlugs: ["best-sellers"],
    options: [SHOE_SIZE(["40", "41", "42", "43", "44"]), COLOR(["Black", "Brown"])],
    variants: [
      { sku: "LDS-BLK-42", optionValues: { Size: "42", Color: "Black" }, quantityOnHand: 6 },
      { sku: "LDS-BRN-43", optionValues: { Size: "43", Color: "Brown" }, quantityOnHand: 4 },
    ],
    imageCount: 2,
  },
  {
    name: "Suede Chukka Boots",
    slug: "suede-chukka-boots",
    description: "Two-eyelet chukka in soft suede over a crepe sole, built for everyday wear.",
    basePrice: 26000,
    categorySlug: "men-shoes",
    collectionSlugs: ["new-arrivals", "the-essentials"],
    options: [SHOE_SIZE(["40", "41", "42", "43"]), COLOR(["Sand", "Grey"])],
    variants: [
      { sku: "SCB-SND-41", optionValues: { Size: "41", Color: "Sand" }, quantityOnHand: 5 },
      { sku: "SCB-GRY-42", optionValues: { Size: "42", Color: "Grey" }, quantityOnHand: 3 },
    ],
    imageCount: 2,
  },

  // ── Kids — Baby ──
  {
    name: "Organic Cotton Onesie Set",
    slug: "organic-cotton-onesie-set",
    description: "A three-piece set in GOTS-certified organic cotton, soft against newborn skin.",
    basePrice: 6000,
    categorySlug: "kids-baby",
    collectionSlugs: ["new-arrivals"],
    options: [BABY_SIZE, COLOR(["Bone", "Sage"])],
    variants: [
      { sku: "OCO-BON-03", optionValues: { Size: "0-3M", Color: "Bone" }, quantityOnHand: 10 },
      { sku: "OCO-SAG-36", optionValues: { Size: "3-6M", Color: "Sage" }, quantityOnHand: 8 },
    ],
    imageCount: 2,
  },
  {
    name: "Knit Baby Cardigan",
    slug: "knit-baby-cardigan",
    description:
      "A button-front cardigan in brushed cotton knit, sized generously for growing room.",
    basePrice: 5000,
    categorySlug: "kids-baby",
    collectionSlugs: ["the-essentials"],
    options: [BABY_SIZE, COLOR(["Oatmeal"])],
    variants: [
      {
        sku: "KBC-OAT-36",
        optionValues: { Size: "3-6M", Color: "Oatmeal" },
        quantityOnHand: 7,
      },
      {
        sku: "KBC-OAT-612",
        optionValues: { Size: "6-12M", Color: "Oatmeal" },
        quantityOnHand: 6,
      },
    ],
    imageCount: 2,
  },

  // ── Kids — Boys ──
  {
    name: "Boys' Cotton Poplin Shirt",
    slug: "boys-cotton-poplin-shirt",
    description: "A lightweight poplin shirt cut for movement, with a soft unfused collar.",
    basePrice: 7000,
    categorySlug: "kids-boys",
    collectionSlugs: ["new-arrivals"],
    options: [KIDS_SIZE, COLOR(["White", "Sky Blue"])],
    variants: [
      { sku: "BCP-WHT-45", optionValues: { Size: "4-5Y", Color: "White" }, quantityOnHand: 8 },
      {
        sku: "BCP-SKY-67",
        optionValues: { Size: "6-7Y", Color: "Sky Blue" },
        quantityOnHand: 6,
      },
    ],
    imageCount: 2,
  },
  {
    name: "Boys' Jogger Pants",
    slug: "boys-jogger-pants",
    description:
      "A relaxed jogger in brushed-back fleece, built for the school run and the playground alike.",
    basePrice: 6500,
    categorySlug: "kids-boys",
    collectionSlugs: ["the-essentials", "best-sellers"],
    options: [KIDS_SIZE, COLOR(["Charcoal", "Navy"])],
    variants: [
      {
        sku: "BJP-CHR-23",
        optionValues: { Size: "2-3Y", Color: "Charcoal" },
        quantityOnHand: 9,
      },
      { sku: "BJP-NVY-45", optionValues: { Size: "4-5Y", Color: "Navy" }, quantityOnHand: 7 },
    ],
    imageCount: 2,
  },

  // ── Kids — Girls ──
  {
    name: "Girls' Cotton Party Dress",
    slug: "girls-cotton-party-dress",
    description: "A twirl-ready dress in soft cotton poplin with a hand-smocked bodice.",
    basePrice: 8000,
    categorySlug: "kids-girls",
    collectionSlugs: ["new-arrivals"],
    options: [KIDS_SIZE, COLOR(["Rose", "Bone"])],
    variants: [
      { sku: "GCP-ROS-23", optionValues: { Size: "2-3Y", Color: "Rose" }, quantityOnHand: 6 },
      { sku: "GCP-BON-45", optionValues: { Size: "4-5Y", Color: "Bone" }, quantityOnHand: 5 },
    ],
    imageCount: 2,
  },
  {
    name: "Girls' Knit Cardigan",
    slug: "girls-knit-cardigan",
    description:
      "A fine-gauge cardigan in cotton-cashmere blend, finished with mother-of-pearl buttons.",
    basePrice: 7500,
    categorySlug: "kids-girls",
    collectionSlugs: ["the-essentials"],
    options: [KIDS_SIZE, COLOR(["Blush"])],
    variants: [
      {
        sku: "GKC-BLS-45",
        optionValues: { Size: "4-5Y", Color: "Blush" },
        quantityOnHand: 5,
      },
      {
        sku: "GKC-BLS-67",
        optionValues: { Size: "6-7Y", Color: "Blush" },
        quantityOnHand: 4,
      },
    ],
    imageCount: 2,
  },

  // ── Accessories — Bags ──
  {
    name: "Leather Tote Bag",
    slug: "leather-tote-bag",
    description:
      "A structured tote in vegetable-tanned leather, roomy enough for daily essentials.",
    basePrice: 42000,
    categorySlug: "accessories-bags",
    collectionSlugs: ["best-sellers"],
    options: [COLOR(["Black", "Cognac"])],
    variants: [
      { sku: "LTB-BLK", optionValues: { Color: "Black" }, quantityOnHand: 5 },
      { sku: "LTB-CGN", optionValues: { Color: "Cognac" }, quantityOnHand: 4 },
    ],
    imageCount: 2,
  },
  {
    name: "Crossbody Leather Bag",
    slug: "crossbody-leather-bag",
    description: "A compact crossbody in smooth calfskin, worn close for the city.",
    basePrice: 31000,
    categorySlug: "accessories-bags",
    collectionSlugs: ["new-arrivals"],
    options: [COLOR(["Black", "Bone"])],
    variants: [
      { sku: "CRB-BLK", optionValues: { Color: "Black" }, quantityOnHand: 6 },
      { sku: "CRB-BON", optionValues: { Color: "Bone" }, quantityOnHand: 3 },
    ],
    imageCount: 2,
  },

  // ── Accessories — Wallets ──
  {
    name: "Bifold Leather Wallet",
    slug: "bifold-leather-wallet",
    description:
      "A slim bifold in full-grain leather, holding six cards and folded notes without bulk.",
    basePrice: 9000,
    categorySlug: "accessories-wallets",
    collectionSlugs: ["the-essentials"],
    options: [COLOR(["Black", "Brown"])],
    variants: [
      { sku: "BLW-BLK", optionValues: { Color: "Black" }, quantityOnHand: 10 },
      { sku: "BLW-BRN", optionValues: { Color: "Brown" }, quantityOnHand: 8 },
    ],
    imageCount: 2,
  },
  {
    name: "Cardholder Wallet",
    slug: "cardholder-wallet",
    description:
      "A minimal cardholder in vegetable-tanned leather, cut from a single piece of hide.",
    basePrice: 6000,
    categorySlug: "accessories-wallets",
    collectionSlugs: ["best-sellers"],
    options: [COLOR(["Black", "Cognac"])],
    variants: [
      { sku: "CHW-BLK", optionValues: { Color: "Black" }, quantityOnHand: 12 },
      { sku: "CHW-CGN", optionValues: { Color: "Cognac" }, quantityOnHand: 9 },
    ],
    imageCount: 2,
  },

  // ── Accessories — Belts ──
  {
    name: "Classic Leather Belt",
    slug: "classic-leather-belt",
    description:
      "A full-grain leather belt with a solid brass buckle, built to outlast the wardrobe around it.",
    basePrice: 8500,
    categorySlug: "accessories-belts",
    collectionSlugs: ["the-essentials"],
    options: [BELT_SIZE, COLOR(["Black", "Brown"])],
    variants: [
      { sku: "CXB-BLK-M", optionValues: { Size: "M", Color: "Black" }, quantityOnHand: 9 },
      { sku: "CXB-BRN-L", optionValues: { Size: "L", Color: "Brown" }, quantityOnHand: 6 },
    ],
    imageCount: 2,
  },
  {
    name: "Woven Leather Belt",
    slug: "woven-leather-belt",
    description:
      "A hand-woven leather belt, more relaxed than the classic strap, for off-duty dressing.",
    basePrice: 9500,
    categorySlug: "accessories-belts",
    collectionSlugs: ["new-arrivals"],
    options: [BELT_SIZE, COLOR(["Tan"])],
    variants: [
      { sku: "WLB-TAN-M", optionValues: { Size: "M", Color: "Tan" }, quantityOnHand: 5 },
      { sku: "WLB-TAN-L", optionValues: { Size: "L", Color: "Tan" }, quantityOnHand: 4 },
    ],
    imageCount: 2,
  },

  // ── Accessories — Caps ──
  {
    name: "Cotton Twill Cap",
    slug: "cotton-twill-cap",
    description:
      "A six-panel cap in washed cotton twill, unstructured for a lived-in fit from day one.",
    basePrice: 4500,
    categorySlug: "accessories-caps",
    collectionSlugs: ["the-essentials"],
    options: [COLOR(["Black", "Stone"])],
    variants: [
      { sku: "CTC-BLK", optionValues: { Color: "Black" }, quantityOnHand: 15 },
      { sku: "CTC-STN", optionValues: { Color: "Stone" }, quantityOnHand: 11 },
    ],
    imageCount: 2,
  },
  {
    name: "Wool Flat Cap",
    slug: "wool-flat-cap",
    description: "A traditional flat cap in Donegal wool tweed, lined in cotton for cooler months.",
    basePrice: 6500,
    categorySlug: "accessories-caps",
    collectionSlugs: ["new-arrivals"],
    options: [COLOR(["Grey Tweed"])],
    variants: [{ sku: "WFC-GRY", optionValues: { Color: "Grey Tweed" }, quantityOnHand: 7 }],
    imageCount: 2,
  },

  // ── Accessories — Sunglasses ──
  {
    name: "Acetate Round Sunglasses",
    slug: "acetate-round-sunglasses",
    description:
      "A round frame in Italian acetate with polarized lenses, equally at home in the city or the coast.",
    basePrice: 18000,
    categorySlug: "accessories-sunglasses",
    collectionSlugs: ["new-arrivals", "best-sellers"],
    options: [COLOR(["Black", "Tortoise"])],
    variants: [
      { sku: "ARS-BLK", optionValues: { Color: "Black" }, quantityOnHand: 8 },
      { sku: "ARS-TRT", optionValues: { Color: "Tortoise" }, quantityOnHand: 6 },
    ],
    imageCount: 2,
  },
  {
    name: "Metal Aviator Sunglasses",
    slug: "metal-aviator-sunglasses",
    description:
      "A slim metal aviator with mineral-glass lenses, a quieter take on the classic silhouette.",
    basePrice: 16000,
    categorySlug: "accessories-sunglasses",
    collectionSlugs: ["the-essentials"],
    options: [COLOR(["Gold", "Gunmetal"])],
    variants: [
      { sku: "MAS-GLD", optionValues: { Color: "Gold" }, quantityOnHand: 5 },
      { sku: "MAS-GNM", optionValues: { Color: "Gunmetal" }, quantityOnHand: 4 },
    ],
    imageCount: 2,
  },

  // ── Accessories — Watches ──
  {
    name: "Stainless Steel Watch",
    slug: "stainless-steel-watch",
    description:
      "A 38mm case in brushed stainless steel with a Swiss quartz movement and sapphire crystal.",
    basePrice: 65000,
    categorySlug: "accessories-watches",
    collectionSlugs: ["best-sellers"],
    options: [COLOR(["Silver", "Black"])],
    variants: [
      { sku: "SSW-SLV", optionValues: { Color: "Silver" }, quantityOnHand: 4 },
      { sku: "SSW-BLK", optionValues: { Color: "Black" }, quantityOnHand: 3 },
    ],
    imageCount: 2,
  },
  {
    name: "Leather Strap Watch",
    slug: "leather-strap-watch",
    description: "A minimal dial on a hand-stitched leather strap, sized for everyday wear.",
    basePrice: 48000,
    categorySlug: "accessories-watches",
    collectionSlugs: ["new-arrivals"],
    options: [COLOR(["Brown", "Black"])],
    variants: [
      { sku: "LSW-BRN", optionValues: { Color: "Brown" }, quantityOnHand: 5 },
      { sku: "LSW-BLK", optionValues: { Color: "Black" }, quantityOnHand: 5 },
    ],
    imageCount: 2,
  },

  // ── Accessories — Jewellery ──
  {
    name: "Sterling Silver Chain Necklace",
    slug: "sterling-silver-chain-necklace",
    description:
      "A fine cable-chain necklace in solid sterling silver, designed to layer or wear alone.",
    basePrice: 12000,
    categorySlug: "accessories-jewellery",
    collectionSlugs: ["the-essentials"],
    options: [{ name: "Length", values: ["16in", "18in", "20in"] }],
    variants: [
      { sku: "SCN-16", optionValues: { Length: "16in" }, quantityOnHand: 7 },
      { sku: "SCN-18", optionValues: { Length: "18in" }, quantityOnHand: 9 },
    ],
    imageCount: 2,
  },
  {
    name: "Gold Vermeil Hoop Earrings",
    slug: "gold-vermeil-hoop-earrings",
    description: "A classic hoop in 18k gold vermeil over sterling silver, finished by hand.",
    basePrice: 9500,
    categorySlug: "accessories-jewellery",
    collectionSlugs: ["new-arrivals", "best-sellers"],
    options: [{ name: "Size", values: ["Small", "Medium", "Large"] }],
    variants: [
      { sku: "GHE-SM", optionValues: { Size: "Small" }, quantityOnHand: 10 },
      { sku: "GHE-MD", optionValues: { Size: "Medium" }, quantityOnHand: 8 },
    ],
    imageCount: 2,
  },
];

function placeholderImageUrl(seed: string, index: number): string {
  // ".png" is required — placehold.co defaults to SVG without an explicit
  // raster extension, and Next.js's image optimizer refuses to optimize
  // SVG by default (dangerouslyAllowSVG), which broke every seeded product
  // image in production (found via a Lighthouse/production-server audit).
  return `https://placehold.co/1200x1500/e7e4de/111111.png?text=${encodeURIComponent(seed)}+${String(index + 1)}`;
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
  for (const department of DEPARTMENTS) {
    const row = await prisma.category.upsert({
      where: { slug: department.slug },
      update: {},
      create: { name: department.name, slug: department.slug },
    });
    categoryIdBySlug.set(department.slug, row.id);
  }
  for (const sub of SUBCATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: sub.slug },
      update: {},
      create: {
        name: sub.name,
        slug: sub.slug,
        parentId: mustGet(categoryIdBySlug, sub.departmentSlug),
      },
    });
    categoryIdBySlug.set(sub.slug, row.id);
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
    let product = await prisma.product.findUnique({ where: { slug: seedProduct.slug } });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: seedProduct.name,
          slug: seedProduct.slug,
          description: seedProduct.description,
          basePrice: seedProduct.basePrice,
          status: "active",
          publishedAt: new Date(),
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

    // Reconciles category assignment for BOTH newly-created and
    // pre-existing seed products — re-running seed after a taxonomy change
    // (like flat "women"/"men" → leaf subcategories) fixes already-seeded
    // rows' category links instead of only ever creating missing products.
    const desiredCategoryId = mustGet(categoryIdBySlug, seedProduct.categorySlug);
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: desiredCategoryId } },
      update: {},
      create: { productId: product.id, categoryId: desiredCategoryId },
    });
    await prisma.productCategory.deleteMany({
      where: { productId: product.id, categoryId: { not: desiredCategoryId } },
    });
  }

  console.warn(
    `Seeded ${String(createdCount)} new catalog products (${String(PRODUCTS.length - createdCount)} already existed).`,
  );
}
