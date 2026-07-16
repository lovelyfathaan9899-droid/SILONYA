import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState, Section } from "@silonya/ui";
import { createServerCaller } from "@/lib/trpc-caller";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Lookbooks",
  description: "Seasonal editorial and styling stories from SILONYA.",
  alternates: { canonical: "/lookbooks" },
};

export default async function LookbooksIndexPage() {
  const caller = createServerCaller();
  const lookbooks = await caller.cms.listPages({ type: "lookbook" });

  return (
    <Section spacing="lg">
      <h1 className="font-display text-ink mb-8 text-3xl md:text-4xl">Lookbooks</h1>
      {lookbooks.length === 0 ? (
        <EmptyState
          title="No lookbooks yet"
          description="Check back soon for our latest stories."
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {lookbooks.map((lookbook) => (
            <Link
              key={lookbook.slug}
              href={`/lookbooks/${lookbook.slug}`}
              className="group flex flex-col gap-3"
            >
              <div className="bg-mist relative aspect-[3/4] w-full overflow-hidden">
                {lookbook.heroImageUrl ? (
                  <Image
                    src={lookbook.heroImageUrl}
                    alt={lookbook.heroImageAlt ?? lookbook.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                ) : null}
              </div>
              <h2 className="font-display text-ink text-lg">{lookbook.title}</h2>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
