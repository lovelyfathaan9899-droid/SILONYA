import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Section } from "@silonya/ui";
import { FilterPanel } from "@/components/FilterPanel";
import { ProductGridSection } from "@/components/ProductGridSection";
import { createServerCaller } from "@/lib/trpc-caller";

// Query-dependent thin content — noindex like every other faceted/search
// results page, even though it's still fully server-rendered so a direct
// link to /search?q=... works and is shareable (SearchPalette's comment:
// this route is what search engines would otherwise see instead).
export const metadata: Metadata = {
  title: "Search — SILONYA",
  robots: { index: false, follow: true },
};

function parsePriceParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

interface PageProps {
  searchParams: Promise<{
    q?: string;
    color?: string;
    size?: string;
    priceMin?: string;
    priceMax?: string;
    inStock?: string;
  }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const hasActiveFilters = Boolean(
    sp.color ?? sp.size ?? sp.priceMin ?? sp.priceMax ?? (sp.inStock === "1" ? "1" : ""),
  );

  const results = query
    ? await createServerCaller().search.query({
        q: query,
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
      })
    : null;

  return (
    <Section spacing="lg">
      <h1 className="font-display text-ink text-3xl md:text-4xl">Search</h1>
      <form action="/search" method="get" className="mt-6 max-w-md">
        <label htmlFor="search-q" className="sr-only">
          Search products
        </label>
        <input
          id="search-q"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products…"
          className="border-mist text-ink placeholder:text-stone focus-visible:ring-ink h-11 w-full border bg-white px-4 font-sans text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      </form>

      <div className="mt-10">
        {!query ? (
          <EmptyState title="Search SILONYA" description="Find products by name." />
        ) : results && results.items.length > 0 ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[14rem_1fr]">
            <div>
              <details className="border-mist mb-6 border lg:hidden">
                <summary className="text-ink cursor-pointer px-4 py-3 font-sans text-sm">
                  Filters
                </summary>
                <div className="border-mist border-t px-4 py-5">
                  <FilterPanel
                    colorFacets={results.facets.color}
                    sizeFacets={results.facets.size}
                  />
                </div>
              </details>
              <div className="hidden lg:block">
                <FilterPanel colorFacets={results.facets.color} sizeFacets={results.facets.size} />
              </div>
            </div>

            <div>
              <p className="text-stone mb-6 font-sans text-sm">
                {results.items.length} result{results.items.length === 1 ? "" : "s"} for &ldquo;
                {query}&rdquo;
              </p>
              <ProductGridSection products={results.items} />
            </div>
          </div>
        ) : (
          <EmptyState
            title="No results"
            description={
              hasActiveFilters
                ? `Nothing matched "${query}" with these filters.`
                : `Nothing matched "${query}".`
            }
            action={
              hasActiveFilters ? (
                <Link
                  href={`/search?q=${encodeURIComponent(query)}`}
                  className="text-ink font-sans text-sm underline underline-offset-4"
                >
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        )}
      </div>
    </Section>
  );
}
