import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, EmptyState, Section } from "@silonya/ui";
import { ProductGridSection } from "@/components/ProductGridSection";
import { SortSelect } from "@/components/SortSelect";
import { createServerCaller } from "@/lib/trpc-caller";
import { breadcrumbListJsonLd, toJsonLdString } from "@/lib/json-ld";
import { categorySlugs } from "@/lib/taxonomy";

export const revalidate = 3600;

const SORTS = ["recommended", "newest", "price-asc", "price-desc"] as const;
type Sort = (typeof SORTS)[number];

function parseSort(value: string | undefined): Sort {
  return (SORTS as readonly string[]).includes(value ?? "") ? (value as Sort) : "recommended";
}

export function generateStaticParams() {
  return categorySlugs.map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const caller = createServerCaller();
  const category = await caller.catalog.getCategoryBySlug({ slug }).catch(() => null);
  if (!category) return {};

  return {
    title: category.name,
    description: `Shop ${category.name} at SILONYA.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);

  const caller = createServerCaller();
  const [category, products] = await Promise.all([
    caller.catalog.getCategoryBySlug({ slug }).catch(() => null),
    caller.catalog.list({ categorySlug: slug, sort, limit: 48 }),
  ]);

  if (!category) {
    notFound();
  }

  const breadcrumbItems = [{ label: "Home", href: "/" }, { label: category.name }];

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

      {products.items.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="This category is being restocked. Check back soon."
        />
      ) : (
        <ProductGridSection products={products.items} />
      )}
    </Section>
  );
}
