"use client";

import { Checkbox, Input, Label, cn } from "@silonya/ui";
import { formatPriceForDisplay, parsePriceToMinorUnits } from "@silonya/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type KeyboardEvent } from "react";

export interface FilterPanelProps {
  colorFacets: Record<string, number>;
  sizeFacets: Record<string, number>;
}

const FILTER_PARAM_KEYS = ["color", "size", "priceMin", "priceMax", "inStock"];

/**
 * Faceted filtering (SEARCH_AND_FILTERS.md §5) — every filter lives in the
 * URL query string, never only in client state, so filtered views are
 * shareable/bookmarkable and survive the back button. Color/size are
 * single-select (search.query's contract — one value each, not arrays);
 * price is a min/max pair in minor units on the wire, major units in the
 * input the shopper sees.
 */
export function FilterPanel({ colorFacets, sizeFacets }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedColor = searchParams.get("color") ?? undefined;
  const selectedSize = searchParams.get("size") ?? undefined;
  const priceMinParam = searchParams.get("priceMin");
  const priceMaxParam = searchParams.get("priceMax");
  const inStock = searchParams.get("inStock") === "1";

  const [priceMinInput, setPriceMinInput] = useState(
    priceMinParam ? (Number(priceMinParam) / 100).toString() : "",
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    priceMaxParam ? (Number(priceMaxParam) / 100).toString() : "",
  );

  function pushParams(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    pushParams(params);
  }

  function applyPriceRange() {
    const min = priceMinInput.trim() ? parsePriceToMinorUnits(priceMinInput) : null;
    const max = priceMaxInput.trim() ? parsePriceToMinorUnits(priceMaxInput) : null;
    const params = new URLSearchParams(searchParams.toString());
    if (min !== null) params.set("priceMin", String(min));
    else params.delete("priceMin");
    if (max !== null) params.set("priceMax", String(max));
    else params.delete("priceMax");
    pushParams(params);
  }

  function handlePriceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      applyPriceRange();
    }
  }

  const hasActiveFilters = Boolean(
    selectedColor ?? selectedSize ?? priceMinParam ?? priceMaxParam ?? (inStock ? "1" : ""),
  );

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_PARAM_KEYS) params.delete(key);
    setPriceMinInput("");
    setPriceMaxInput("");
    pushParams(params);
  }

  const colorEntries = Object.entries(colorFacets).sort((a, b) => b[1] - a[1]);
  const sizeEntries = Object.entries(sizeFacets).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <p className="text-ink font-sans text-sm font-medium">Filters</p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-stone hover:text-ink font-sans text-xs underline underline-offset-4"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {colorEntries.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-stone font-sans text-xs uppercase tracking-wide">Color</p>
          <div className="flex flex-wrap gap-2">
            {colorEntries.map(([color, count]) => (
              <button
                key={color}
                type="button"
                aria-pressed={selectedColor === color}
                onClick={() => {
                  setParam("color", selectedColor === color ? null : color);
                }}
                className={cn(
                  "border px-3 py-1.5 font-sans text-xs transition-colors duration-150",
                  selectedColor === color
                    ? "border-ink bg-ink text-bone"
                    : "border-mist text-ink hover:border-ink",
                )}
              >
                {color} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sizeEntries.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-stone font-sans text-xs uppercase tracking-wide">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizeEntries.map(([size, count]) => (
              <button
                key={size}
                type="button"
                aria-pressed={selectedSize === size}
                onClick={() => {
                  setParam("size", selectedSize === size ? null : size);
                }}
                className={cn(
                  "border px-3 py-1.5 font-sans text-xs transition-colors duration-150",
                  selectedSize === size
                    ? "border-ink bg-ink text-bone"
                    : "border-mist text-ink hover:border-ink",
                )}
              >
                {size} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <p className="text-stone font-sans text-xs uppercase tracking-wide">Price</p>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum price"
            placeholder={
              formatPriceForDisplay(0)
                .replace(/[0-9.,]/g, "")
                .trim() || "$"
            }
            value={priceMinInput}
            onChange={(e) => {
              setPriceMinInput(e.target.value);
            }}
            onBlur={applyPriceRange}
            onKeyDown={handlePriceKeyDown}
            inputMode="decimal"
            className="w-20"
          />
          <span aria-hidden="true" className="text-stone">
            –
          </span>
          <Input
            aria-label="Maximum price"
            placeholder="Any"
            value={priceMaxInput}
            onChange={(e) => {
              setPriceMaxInput(e.target.value);
            }}
            onBlur={applyPriceRange}
            onKeyDown={handlePriceKeyDown}
            inputMode="decimal"
            className="w-20"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-in-stock"
          checked={inStock}
          onCheckedChange={() => {
            setParam("inStock", inStock ? null : "1");
          }}
        />
        <Label htmlFor="filter-in-stock">In stock only</Label>
      </div>
    </div>
  );
}
