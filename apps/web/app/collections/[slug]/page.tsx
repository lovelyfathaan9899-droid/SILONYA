import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, EmptyState, Section } from "@silonya/ui";
import { ProductGridSection } from "@/components/ProductGridSection";
import { SortSelect } from "@/components/SortSelect";
import { createServerCaller } from "@/lib/trpc-caller";
import { featuredCollectionSlugs } from "@/lib/homepage-content";
import { breadcrumbListJsonLd, toJsonLdString } from "@/lib/json-ld";

export const revalidate = 3600;

const SORTS = ["recommended", "newest", "price-asc", "price-desc"] as const;
type Sort = (typeof SORTS)[number];

function parseSort(value: string | undefined): Sort {
  return (SORTS as readonly string[]).includes(value ?? "") ? (value as Sort) : "recommended";
}

export function generateStaticParams() {
  return featuredCollectionSlugs.map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const caller = createServerCaller();
  const collection = await caller.catalog.getCollectionBySlug({ slug }).catch(() => null);
  if (!collection) return {};

  const description =
    collection.description ?? `Shop the ${collection.name} collection at SILONYA.`;
  return {
    title: collection.name,
    description,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: { title: collection.name, description, type: "website" },
    twitter: { card: "summary_large_image", title: collection.name, description },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);

  const caller = createServerCaller();
  const [collection, products] = await Promise.all([
    caller.catalog.getCollectionBySlug({ slug }).catch(() => null),
    caller.catalog.list({ collectionSlug: slug, sort, limit: 48 }),
  ]);

  if (!collection) {
    notFound();
  }

  const breadcrumbItems = [{ label: "Home", href: "/" }, { label: collection.name }];

  return (
    <Section spacing="lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdString(breadcrumbListJsonLd(breadcrumbItems)) }}
      />
      <Breadcrumbs items={breadcrumbItems} linkAs={Link} className="mb-6" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-ink text-3xl md:text-4xl">{collection.name}</h1>
          {collection.description ? (
            <p className="text-stone mt-2 max-w-[65ch] font-sans text-sm">
              {collection.description}
            </p>
          ) : null}
        </div>
        <SortSelect value={sort} />
      </div>

      {products.items.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="This collection is being restocked. Check back soon."
        />
      ) : (
        <ProductGridSection products={products.items} />
      )}
    </Section>
  );
}
