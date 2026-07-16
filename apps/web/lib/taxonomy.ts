import { departments } from "./departments";

// The catalog router has no public "list all categories" endpoint (only
// getCategoryBySlug) — this is the one place static category routes
// (generateStaticParams, sitemap) read the known slugs from.
export const categorySlugs: string[] = departments.flatMap((department) => [
  department.slug,
  ...department.subcategories.map((sub) => sub.slug),
]);
