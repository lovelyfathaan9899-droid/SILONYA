import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Section } from "@silonya/ui";
import { createServerCaller } from "@/lib/trpc-caller";
import { SITE_URL } from "@/lib/site-config";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const caller = createServerCaller();
  const page = await caller.cms.getPageBySlug({ slug }).catch(() => null);
  if (!page) return {};

  const description = page.seoDescription ?? page.body.slice(0, 160);
  return {
    title: page.seoTitle ?? page.title,
    description,
    alternates: { canonical: `/pages/${page.slug}` },
    openGraph: {
      title: page.seoTitle ?? page.title,
      description,
      ...(page.heroImageUrl ? { images: [page.heroImageUrl] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.seoTitle ?? page.title,
      description,
    },
  };
}

export default async function StaticOrEditorialPage({ params }: PageProps) {
  const { slug } = await params;
  const caller = createServerCaller();
  const page = await caller.cms.getPageBySlug({ slug }).catch(() => null);

  if (!page || page.type === "lookbook") {
    // Lookbooks have their own route/template (/lookbooks/[slug]) — a page
    // fetched here with that type means the slug moved; treat as not found
    // rather than rendering the wrong template.
    notFound();
  }

  const paragraphs = page.body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: page.title,
        item: `${SITE_URL}/pages/${page.slug}`,
      },
    ],
  };

  return (
    <Section spacing="lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mx-auto max-w-[65ch]">
        <h1 className="font-display text-ink text-3xl md:text-4xl">{page.title}</h1>
        {page.heroImageUrl ? (
          <div className="relative mt-8 aspect-[3/2] w-full">
            <Image
              src={page.heroImageUrl}
              alt={page.heroImageAlt ?? page.title}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 65ch, 100vw"
            />
          </div>
        ) : null}
        <div className="mt-8 flex flex-col gap-4">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-stone font-sans text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </Section>
  );
}
