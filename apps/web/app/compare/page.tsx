"use client";

import { Button, EmptyState, PriceDisplay, Section } from "@silonya/ui";
import Link from "next/link";
import { useCompareStore } from "@/lib/stores/compareStore";

export default function ComparePage() {
  const entries = useCompareStore((state) => state.entries);
  const remove = useCompareStore((state) => state.remove);
  const clear = useCompareStore((state) => state.clear);

  if (entries.length === 0) {
    return (
      <Section spacing="lg">
        <EmptyState
          title="Nothing to compare yet"
          description='Use the "Compare" button on a product page to add items here.'
          action={
            <Button asChild>
              <Link href="/">Continue shopping</Link>
            </Button>
          }
        />
      </Section>
    );
  }

  return (
    <Section spacing="lg">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-ink text-3xl md:text-4xl">Compare</h1>
        <Button variant="ghost" onClick={clear}>
          Clear all
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${String(entries.length)}, minmax(200px, 1fr))` }}
        >
          {entries.map((entry) => (
            <div key={entry.productId} className="border-mist flex flex-col gap-3 border p-4">
              {entry.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small comparison thumbnail
                <img
                  src={entry.imageUrl}
                  alt={entry.name}
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : (
                <div className="bg-mist aspect-[3/4] w-full" />
              )}
              <Link
                href={`/products/${entry.slug}`}
                className="text-ink font-sans text-sm underline"
              >
                {entry.name}
              </Link>
              <PriceDisplay price={entry.price} currency={entry.currency} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  remove(entry.productId);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
