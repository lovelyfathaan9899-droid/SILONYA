import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, EmptyState, Section } from "@silonya/ui";
import { FilterPanel } from "@/components/FilterPanel";
import { ProductGridSection } from "@/components/ProductGridSection";
import { SortSelect } from "@/components/SortSelect";
import { createServerCaller } from "@/lib/trpc-caller";
import { breadcrumbListJsonLd, toJsonLdString } from "@/lib/json-ld";
import { categorySlugs } from "@/lib/taxonomy";

export const revalidate = 3600;

const SORTS = ["recommended", "newest", "price-asc", "price-desc"] as const;
type Sort = (typeof SORTS)[number];
// search.query's SORT enum has no "recommended" — it's a merchandising
// concept specific to catalog.list (PRODUCT_SYSTEM.md §7) that doesn't
// exist in the search index yet, so it maps to search's no-op default.
const SORT_TO_SEARCH: Record<Sort, "relevance" | "newest" | "price-asc" | "price-desc"> = {
  recommended: "relevance",
  newest: "newest",
  "price-asc": "price-asc",
  "price-desc": "price-desc",
};

function parseSort(value: string | undefined): Sort {
  return (SORTS as readonly string[]).includes(value ?? "") ? (value as Sort) : "recommended";
}

function parsePriceParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function generateStaticParams() {
  return categorySlugs.map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    color?: string;
    size?: string;
    priceMin?: string;
    priceMax?: string;
    inStock?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const caller = createServerCaller();
  const category = await caller.catalog.getCategoryBySlug({ slug }).catch(() => null);
  if (!category) return {};

  const description = `Shop ${category.name} at SILONYA.`;
  return {
    title: category.name,
    description,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: { title: category.name, description, type: "website" },
    twitter: { card: "summary_large_image", title: category.name, description },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = parseSort(sp.sort);

  const caller = createServerCaller();
  const [category, results] = await Promise.all([
    caller.catalog.getCategoryBySlug({ slug }).catch(() => null),
    caller.search.query({
      category: slug,
      sort: SORT_TO_SEARCH[sort],
      ...(sp.color ? { color: sp.color } : {}),
      ...(sp.size ? { size: sp.size } : {}),
      ...(parsePriceParam(sp.priceMin) !== undefined
        ? { priceMin: parsePriceParam(sp.priceMin) }
        : {}),
      ...(parsePriceParam(sp.priceMax) !== undefined
        ? { priceMax: parsePriceParam(sp.priceMax) }
        : {}),
      availableOnly: sp.inStock === "1",
      limit: 48,
    }),
  ]);

  if (!category) {
    notFound();
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    ...(category.parent
      ? [{ label: category.parent.name, href: `/categories/${category.parent.slug}` }]
      : []),
    { label: category.name },
  ];

  const hasActiveFilters = Boolean(
    sp.color ?? sp.size ?? sp.priceMin ?? sp.priceMax ?? (sp.inStock === "1" ? "1" : ""),
  );

  return (
    <Section spacing="lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdString(breadcrumbListJsonLd(breadcrumbItems)) }}
      />
      <Breadcrumbs items={breadcrumbItems} linkAs={Link} className="mb-6" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-ink text-3xl md:text-4xl">{category.name}</h1>
        <SortSelect value={sort} />
      </div>

      {category.children.length > 0 ? (
        <div className="mb-8 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.slug}
              href={`/categories/${child.slug}`}
              className="border-mist text-ink hover:border-ink border px-4 py-2 font-sans text-sm transition-colors duration-150"
            >
              {child.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[14rem_1fr]">
        <div>
          <details className="border-mist mb-6 border lg:hidden">
            <summary className="text-ink cursor-pointer px-4 py-3 font-sans text-sm">
              Filters
            </summary>
            <div className="border-mist border-t px-4 py-5">
              <FilterPanel colorFacets={results.facets.color} sizeFacets={results.facets.size} />
            </div>
          </details>
          <div className="hidden lg:block">
            <FilterPanel colorFacets={results.facets.color} sizeFacets={results.facets.size} />
          </div>
        </div>

        <div>
          {results.items.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? "No products match these filters" : "No products yet"}
              description={
                hasActiveFilters
                  ? "Try adjusting or clearing your filters."
                  : "This category is being restocked. Check back soon."
              }
              action={
                hasActiveFilters ? (
                  <Link
                    href={`/categories/${slug}`}
                    className="text-ink font-sans text-sm underline underline-offset-4"
                  >
                    Clear filters
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ProductGridSection products={results.items} />
          )}
        </div>
      </div>
    </Section>
  );
}
