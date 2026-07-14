import type { Metadata } from "next";
import { EmptyState, Section } from "@silonya/ui";
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

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query
    ? await createServerCaller().catalog.list({ search: query, limit: 48 })
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
          <>
            <p className="text-stone mb-6 font-sans text-sm">
              {results.items.length} result{results.items.length === 1 ? "" : "s"} for &ldquo;
              {query}&rdquo;
            </p>
            <ProductGridSection products={results.items} />
          </>
        ) : (
          <EmptyState title="No results" description={`Nothing matched "${query}".`} />
        )}
      </div>
    </Section>
  );
}
