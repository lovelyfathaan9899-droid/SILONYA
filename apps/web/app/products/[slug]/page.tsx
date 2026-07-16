import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, ProductGallery, Section } from "@silonya/ui";
import { ProductGridSection } from "@/components/ProductGridSection";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { ReviewsSection } from "@/components/ReviewsSection";
import { createServerCaller } from "@/lib/trpc-caller";
import { breadcrumbListJsonLd, toJsonLdString } from "@/lib/json-ld";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const caller = createServerCaller();
  const product = await caller.catalog.getBySlug({ slug }).catch(() => null);
  if (!product) return {};

  const description =
    product.seoDescription ??
    product.description?.slice(0, 160) ??
    `Shop ${product.name} at SILONYA.`;
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.seoTitle ?? product.name,
      description,
      type: "website",
      images: product.media[0] ? [product.media[0].url] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.seoTitle ?? product.name,
      description,
      images: product.media[0] ? [product.media[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const caller = createServerCaller();
  const product = await caller.catalog.getBySlug({ slug }).catch(() => null);

  if (!product) {
    notFound();
  }

  const prices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const available = product.variants.some((v) => v.available);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.name,
    image: product.media.map((m) => m.url),
    brand: { "@type": "Brand", name: "SILONYA" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency,
      lowPrice: (minPrice / 100).toFixed(2),
      highPrice: (maxPrice / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    ...(product.category
      ? [{ label: product.category.name, href: `/categories/${product.category.slug}` }]
      : []),
    { label: product.name },
  ];

  return (
    <Section spacing="lg">
      <RecentlyViewedTracker productId={product.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdString(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdString(breadcrumbListJsonLd(breadcrumbItems)) }}
      />
      <Breadcrumbs items={breadcrumbItems} linkAs={Link} className="mb-6" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.media.map((m) => ({ url: m.url, altText: m.altText }))} />
        <ProductPurchasePanel
          productId={product.id}
          slug={product.slug}
          name={product.name}
          currency={product.currency}
          options={product.options}
          variants={product.variants}
          media={product.media}
        />
      </div>

      <div className="mt-16 max-w-[65ch]">
        <h2 className="font-display text-ink text-xl">Details</h2>
        <p className="text-stone mt-3 font-sans text-sm">{product.description}</p>
      </div>

      <ReviewsSection productId={product.id} />

      {product.related.length > 0 ? (
        <div className="mt-20">
          <h2 className="font-display text-ink mb-8 text-3xl md:text-4xl">You may also like</h2>
          <ProductGridSection products={product.related} />
        </div>
      ) : null}
    </Section>
  );
}
