"use client";

import { useMemo, useState } from "react";
import {
  Button,
  ColorSelector,
  PriceDisplay,
  SizeSelector,
  StockStatus,
  WishlistButton,
} from "@silonya/ui";
import { useCartStore } from "@/lib/stores/cartStore";
import { useCompareStore } from "@/lib/stores/compareStore";
import { useWishlistStore } from "@/lib/stores/wishlistStore";
import { useIsLoggedIn } from "@/lib/customer-session-client";
import { trpcClient } from "@/lib/trpc-client";

interface OptionValue {
  id: string;
  value: string;
}

interface ProductOption {
  id: string;
  name: string;
  values: OptionValue[];
}

interface Variant {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  optionValueIds: string[];
}

interface Media {
  url: string;
  altText: string;
  variantId: string | null;
}

export interface ProductPurchasePanelProps {
  productId: string;
  slug: string;
  name: string;
  currency: string;
  options: ProductOption[];
  variants: Variant[];
  media: Media[];
}

/**
 * Client island holding all PDP interactivity: variant selection (with
 * per-value availability derived live from `variants`, PRODUCT_SYSTEM.md
 * §4.1 — never hide an out-of-stock combination, disable it), wishlist, and
 * add-to-bag. The server component around this only fetches data; every
 * store subscription lives here.
 */
export function ProductPurchasePanel({
  productId,
  slug,
  name,
  currency,
  options,
  variants,
  media,
}: ProductPurchasePanelProps) {
  const valueIdToOptionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      for (const value of option.values) map.set(value.id, option.id);
    }
    return map;
  }, [options]);

  const valueLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      for (const value of option.values) map.set(value.id, value.value);
    }
    return map;
  }, [options]);

  const defaultSelection = useMemo(() => {
    const preferred = variants.find((v) => v.available) ?? variants[0];
    const selection: Record<string, string> = {};
    if (preferred) {
      for (const valueId of preferred.optionValueIds) {
        const optionId = valueIdToOptionId.get(valueId);
        if (optionId) selection[optionId] = valueId;
      }
    }
    return selection;
  }, [variants, valueIdToOptionId]);

  const [selected, setSelected] = useState<Record<string, string>>(defaultSelection);

  const selectedVariant = useMemo(
    () =>
      variants.find((variant) =>
        options.every((option) => {
          const chosen = selected[option.id];
          return chosen ? variant.optionValueIds.includes(chosen) : false;
        }),
      ),
    [variants, options, selected],
  );

  function isValueAvailable(optionId: string, valueId: string): boolean {
    return variants.some(
      (variant) =>
        variant.available &&
        variant.optionValueIds.includes(valueId) &&
        options.every((option) => {
          if (option.id === optionId) return true;
          const chosen = selected[option.id];
          return !chosen || variant.optionValueIds.includes(chosen);
        }),
    );
  }

  const addLine = useCartStore((state) => state.addLine);
  const wishlisted = useWishlistStore((state) => state.has(productId));
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const loggedIn = useIsLoggedIn();

  const compared = useCompareStore((state) => state.has(productId));
  const toggleCompare = useCompareStore((state) => state.toggle);

  const fallbackPrice = Math.min(...variants.map((v) => v.price));
  const price = selectedVariant?.price ?? fallbackPrice;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? null;
  const available = selectedVariant?.available ?? false;

  function handleWishlistToggle() {
    toggleWishlist(productId);
    // Database-backed wishlist sync for signed-in customers (SHOPPING
    // FEATURES) — the local store stays the source of truth for the
    // anonymous heart-button UX either way.
    if (loggedIn && selectedVariant) {
      const mutation = wishlisted
        ? trpcClient.account.wishlist.remove.mutate({ variantId: selectedVariant.id })
        : trpcClient.account.wishlist.add.mutate({ variantId: selectedVariant.id });
      mutation.catch(() => {
        // Best-effort sync — the local wishlist toggle already succeeded.
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-ink text-3xl md:text-4xl">{name}</h1>
          <PriceDisplay
            price={price}
            compareAtPrice={compareAtPrice}
            currency={currency}
            className="mt-2 text-lg"
          />
        </div>
        <div className="flex items-center gap-2">
          <WishlistButton active={wishlisted} onToggle={handleWishlistToggle} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              toggleCompare({
                productId,
                slug,
                name,
                price,
                currency,
                imageUrl: media[0]?.url ?? null,
              });
            }}
          >
            {compared ? "Added to compare" : "Compare"}
          </Button>
        </div>
      </div>

      {options.map((option) => {
        const isColor = option.name.toLowerCase() === "color";
        const optionValues = option.values.map((value) => ({
          value: value.id,
          label: value.value,
          disabled: !isValueAvailable(option.id, value.id),
        }));
        const onChange = (value: string) => {
          setSelected((prev) => ({ ...prev, [option.id]: value }));
        };
        const selectedValue = selected[option.id];
        const sharedProps = {
          label: option.name,
          options: optionValues,
          onChange,
          ...(selectedValue !== undefined ? { value: selectedValue } : {}),
        };

        return isColor ? (
          <ColorSelector key={option.id} {...sharedProps} />
        ) : (
          <SizeSelector key={option.id} {...sharedProps} />
        );
      })}

      <StockStatus available={available} />

      <Button
        size="lg"
        disabled={!selectedVariant || !available}
        onClick={() => {
          if (!selectedVariant) return;
          const variantLabel = options
            .map((option) => {
              const chosen = selected[option.id];
              return chosen ? valueLabel.get(chosen) : undefined;
            })
            .filter((label): label is string => Boolean(label))
            .join(" / ");
          const image = media.find((m) => m.variantId === selectedVariant.id) ?? media[0] ?? null;

          addLine({
            variantId: selectedVariant.id,
            productSlug: slug,
            productName: name,
            variantLabel,
            unitPrice: selectedVariant.price,
            currency,
            imageUrl: image?.url ?? null,
          });
        }}
      >
        {available ? "Add to bag" : "Sold out"}
      </Button>
    </div>
  );
}
