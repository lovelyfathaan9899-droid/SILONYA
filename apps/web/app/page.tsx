import type { Metadata } from "next";
import { CollectionCard, EditorialSection, Hero, PromoBanner, Section } from "@silonya/ui";
import { ProductGridSection } from "@/components/ProductGridSection";
import { createServerCaller } from "@/lib/trpc-caller";
import { editorial, featuredCollectionSlugs, hero, promo } from "@/lib/homepage-content";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Considered clothing for a considered life",
  description:
    "SILONYA is a luxury clothing house built on quality cloth and quiet construction. Shop new arrivals, best sellers, and seasonal essentials.",
  alternates: { canonical: "/" },
};

// SSG+ISR — the homepage is fully server-rendered with no client-JS-dependent
// critical content (SEO_ARCHITECTURE.md §2).
export const revalidate = 3600;

async function getFeaturedCollections() {
  const caller = createServerCaller();

  return Promise.all(
    featuredCollectionSlugs.map(async (slug) => {
      const [collection, products] = await Promise.all([
        caller.catalog.getCollectionBySlug({ slug }).catch(() => null),
        caller.catalog.list({ collectionSlug: slug, limit: 1 }),
      ]);
      if (!collection) return null;

      const cover = products.items[0]?.image;
      return {
        slug: collection.slug,
        name: collection.name,
        description: collection.description ?? undefined,
        image: cover ?? {
          url: "https://placehold.co/900x1200/e7e4de/111111?text=SILONYA",
          altText: collection.name,
        },
      };
    }),
  );
}

export default async function HomePage() {
  const caller = createServerCaller();
  const [collections, newArrivals, bestSellers] = await Promise.all([
    getFeaturedCollections(),
    caller.catalog.list({ collectionSlug: "new-arrivals", sort: "newest", limit: 4 }),
    caller.catalog.list({ collectionSlug: "best-sellers", limit: 4 }),
  ]);

  return (
    <>
      <Hero
        image={hero.image}
        eyebrow={hero.eyebrow}
        heading={hero.heading}
        subheading={hero.subheading}
        ctaLabel={hero.ctaLabel}
        ctaHref={hero.ctaHref}
      />

      <Section spacing="lg">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-ink text-3xl md:text-4xl">Shop by collection</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {collections.map((collection) =>
            collection ? (
              <CollectionCard
                key={collection.slug}
                slug={collection.slug}
                name={collection.name}
                image={collection.image}
                {...(collection.description ? { description: collection.description } : {})}
              />
            ) : null,
          )}
        </div>
      </Section>

      <Section spacing="lg" className="bg-mist/40">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-ink text-3xl md:text-4xl">New arrivals</h2>
          <Link
            href="/collections/new-arrivals"
            className="text-ink font-sans text-sm underline underline-offset-4"
          >
            Shop all
          </Link>
        </div>
        <ProductGridSection products={newArrivals.items} />
      </Section>

      <PromoBanner message={promo.message} />

      <Section spacing="lg">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-ink text-3xl md:text-4xl">Best sellers</h2>
          <Link
            href="/collections/best-sellers"
            className="text-ink font-sans text-sm underline underline-offset-4"
          >
            Shop all
          </Link>
        </div>
        <ProductGridSection products={bestSellers.items} />
      </Section>

      <EditorialSection
        image={editorial.image}
        eyebrow={editorial.eyebrow}
        heading={editorial.heading}
        body={editorial.body}
        ctaLabel={editorial.ctaLabel}
        ctaHref={editorial.ctaHref}
        imagePosition="left"
        className="pb-24"
      />
    </>
  );
}
