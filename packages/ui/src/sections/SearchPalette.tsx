"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";
import { EmptyState } from "../patterns/EmptyState";
import { PriceDisplay } from "../patterns/PriceDisplay";
import { Spinner } from "../primitives/Spinner";

export interface SearchResult {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  image: { url: string; altText: string } | null;
}

export interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  isLoading?: boolean;
  onResultClick?: () => void;
}

/**
 * Fetching/debouncing is the consuming app's job (Section-tier data
 * fetching, PROJECT_RULES.md §3) — this only renders whatever `results` it's
 * given. `/search?q=` (a real page, not just this palette) is what search
 * engines see; this dialog is a fast-path for people already on the site.
 */
export function SearchPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  isLoading = false,
  onResultClick,
}: SearchPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/40 fixed inset-0 z-40" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            "bg-bone fixed inset-x-0 top-0 z-50 flex max-h-[80vh] w-full flex-col shadow-lg",
            "focus-visible:outline-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="border-mist flex items-center gap-3 border-b px-4 py-4 sm:px-6">
            <Icon icon={Search} size={20} className="text-stone shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
              }}
              placeholder="Search products…"
              className="text-ink placeholder:text-stone w-full bg-transparent font-sans text-base focus:outline-none"
            />
            <DialogPrimitive.Close
              aria-label="Close search"
              className="text-ink focus-visible:ring-ink flex h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Icon icon={X} size={20} />
            </DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto px-4 py-4 sm:px-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : query.trim().length === 0 ? null : results.length === 0 ? (
              <EmptyState title="No results" description={`Nothing matched "${query}".`} />
            ) : (
              <ul className="flex flex-col gap-4">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link
                      href={`/products/${result.slug}`}
                      className="flex items-center gap-4 py-2 hover:bg-white"
                      {...(onResultClick ? { onClick: onResultClick } : {})}
                    >
                      <div className="bg-mist relative h-16 w-14 shrink-0 overflow-hidden">
                        {result.image ? (
                          <Image
                            src={result.image.url}
                            alt=""
                            fill
                            sizes="3.5rem"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-ink font-sans text-sm">{result.name}</span>
                        <PriceDisplay
                          price={result.price}
                          currency={result.currency}
                          className="text-xs"
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
