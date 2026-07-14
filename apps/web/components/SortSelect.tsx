"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@silonya/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

/**
 * Writes `?sort=` and triggers a server navigation (PLP stays SSR base per
 * SEO_ARCHITECTURE.md §2 — sort is a query param, not client-side re-fetch).
 */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === "recommended") {
          params.delete("sort");
        } else {
          params.set("sort", next);
        }
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
