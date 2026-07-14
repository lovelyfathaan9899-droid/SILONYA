"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "../lib/cn";

export interface ProductGalleryProps {
  images: { url: string; altText: string }[];
  className?: string;
}

export function ProductGallery({ images, className }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  if (!active) {
    return <div className={cn("bg-mist aspect-[4/5] w-full", className)} aria-hidden="true" />;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="bg-mist relative aspect-[4/5] w-full overflow-hidden">
        <Image
          key={active.url}
          src={active.url}
          alt={active.altText}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div role="tablist" aria-label="Product images" className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`View image ${String(index + 1)}`}
              onClick={() => {
                setActiveIndex(index);
              }}
              className={cn(
                "bg-mist relative h-20 w-16 shrink-0 overflow-hidden border transition-colors duration-150",
                index === activeIndex ? "border-ink" : "hover:border-mist border-transparent",
                "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              )}
            >
              <Image src={image.url} alt="" fill sizes="4rem" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
