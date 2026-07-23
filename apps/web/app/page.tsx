import type { Metadata } from "next";
import { CollectionCard, EditorialSection, Hero, PromoBanner, Section } from "@silonya/ui";
import { ProductGridSection } from "@/components/ProductGridSection";
import { createServerCaller } from "@/lib/trpc-caller";
import { editorial, featuredCollectionSlugs, hero, promo } from "@/lib/homepage-content";
import { departments } from "@/lib/departments";
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

async function getFeaturedDepartments() {
  const caller = createServerCaller();

  return Promise.all(
    departments.map(async (department) => {
      const products = await caller.catalog.list({ categorySlug: department.slug, limit: 1 });
      const cover = products.items[0]?.image;
      return {
        slug: department.slug,
        name: department.name,
        image: cover ?? {
          url: "https://placehold.co/900x1200/e7e4de/111111.png?text=SILONYA",
          altText: department.name,
        },
      };
    }),
  );
}

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
  const [featuredDepartments, collections, newArrivals, bestSellers, cmsContent] =
    await Promise.all([
      getFeaturedDepartments(),
      getFeaturedCollections(),
      caller.catalog.list({ collectionSlug: "new-arrivals", sort: "newest", limit: 4 }),
      caller.catalog.list({ collectionSlug: "best-sellers", limit: 4 }),
      caller.cms.homepageContent(),
    ]);

  // CMS-driven content (ADMIN_PANEL.md §4.6) with a hardcoded fallback
  // (lib/homepage-content.ts) so the homepage never renders empty before
  // the CMS has these singletons seeded.
  const heroContent = cmsContent.hero?.isActive
    ? {
        image: {
          url: cmsContent.hero.imageUrl ?? hero.image.url,
          altText: cmsContent.hero.imageAlt ?? hero.image.altText,
        },
        eyebrow: cmsContent.hero.eyebrow ?? hero.eyebrow,
        heading: cmsContent.hero.heading ?? hero.heading,
        subheading: cmsContent.hero.subheading ?? hero.subheading,
        ctaLabel: cmsContent.hero.ctaLabel ?? hero.ctaLabel,
        ctaHref: cmsContent.hero.ctaHref ?? hero.ctaHref,
      }
    : hero;
  const promoMessage = cmsContent.promoBanner?.isActive
    ? (cmsContent.promoBanner.body ?? promo.message)
    : promo.message;
  const showPromoBanner = cmsContent.promoBanner ? cmsContent.promoBanner.isActive : true;
  const editorialContent = cmsContent.editorial?.isActive
    ? {
        image: {
          url: cmsContent.editorial.imageUrl ?? editorial.image.url,
          altText: cmsContent.editorial.imageAlt ?? editorial.image.altText,
        },
        eyebrow: cmsContent.editorial.eyebrow ?? editorial.eyebrow,
        heading: cmsContent.editorial.heading ?? editorial.heading,
        body: cmsContent.editorial.body ?? editorial.body,
        ctaLabel: cmsContent.editorial.ctaLabel ?? editorial.ctaLabel,
        ctaHref: cmsContent.editorial.ctaHref ?? editorial.ctaHref,
      }
    : editorial;

  return (
    <>
      <Hero
        image={heroContent.image}
        eyebrow={heroContent.eyebrow}
        heading={heroContent.heading}
        subheading={heroContent.subheading}
        ctaLabel={heroContent.ctaLabel}
        ctaHref={heroContent.ctaHref}
      />

      <Section spacing="lg" className="bg-mist/40">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-ink text-3xl md:text-4xl">Shop by department</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredDepartments.map((department) => (
            <CollectionCard
              key={department.slug}
              slug={department.slug}
              name={department.name}
              image={department.image}
              href={`/categories/${department.slug}`}
            />
          ))}
        </div>
      </Section>

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
            className="text-ink -my-2.5 inline-block py-2.5 font-sans text-sm underline underline-offset-4"
          >
            Shop all
          </Link>
        </div>
        <ProductGridSection products={newArrivals.items} />
      </Section>

      {showPromoBanner ? <PromoBanner message={promoMessage} /> : null}

      <Section spacing="lg">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-ink text-3xl md:text-4xl">Best sellers</h2>
          <Link
            href="/collections/best-sellers"
            className="text-ink -my-2.5 inline-block py-2.5 font-sans text-sm underline underline-offset-4"
          >
            Shop all
          </Link>
        </div>
        <ProductGridSection products={bestSellers.items} />
      </Section>

      <EditorialSection
        image={editorialContent.image}
        eyebrow={editorialContent.eyebrow}
        heading={editorialContent.heading}
        body={editorialContent.body}
        ctaLabel={editorialContent.ctaLabel}
        ctaHref={editorialContent.ctaHref}
        imagePosition="left"
        className="pb-24"
      />
    </>
  );
}
