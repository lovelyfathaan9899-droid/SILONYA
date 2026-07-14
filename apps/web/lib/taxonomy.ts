// Mirrors packages/database/prisma/seed-catalog.ts's CATEGORIES — the
// catalog router has no "list all categories" endpoint yet (PRODUCT_SYSTEM.md
// doesn't need one until the tree grows past two top-level nodes), so this
// is the one place static category routes (generateStaticParams, sitemap)
// read the known slugs from.
export const categorySlugs = ["women", "men"] as const;
