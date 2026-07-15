"use client";

import type { AppRouter } from "@silonya/api";
import { Button, EmptyState, PriceDisplay, toast } from "@silonya/ui";
import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { useState } from "react";
import { useCartStore } from "@/lib/stores/cartStore";
import { trpcClient } from "@/lib/trpc-client";

type WishlistData = inferRouterOutputs<AppRouter>["account"]["wishlist"]["list"];
type WishlistItem = WishlistData["wishlist"][number];

function WishlistRow({
  item,
  onRemove,
  onMoveToBag,
}: {
  item: WishlistItem;
  onRemove: () => void;
  onMoveToBag?: () => void;
}) {
  return (
    <div className="border-mist flex items-center justify-between gap-4 border-b py-4">
      <div className="flex items-center gap-4">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- account dashboard thumbnail, not a hero image worth next/image's overhead here
          <img src={item.image.url} alt={item.image.altText} className="h-16 w-16 object-cover" />
        ) : null}
        <div>
          <Link
            href={`/products/${item.productSlug}`}
            className="text-ink font-sans text-sm underline"
          >
            {item.productName}
          </Link>
          {item.variantLabel ? (
            <p className="text-stone font-sans text-xs">{item.variantLabel}</p>
          ) : null}
          <PriceDisplay price={item.price} currency={item.currency} className="text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        {onMoveToBag ? (
          <Button variant="secondary" size="sm" onClick={onMoveToBag}>
            Move to bag
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export function WishlistManager({ initial }: { initial: WishlistData }) {
  const [wishlist, setWishlist] = useState(initial.wishlist);
  const [savedForLater, setSavedForLater] = useState(initial.savedForLater);
  const addLine = useCartStore((state) => state.addLine);

  async function handleRemove(variantId: string, list: "wishlist" | "savedForLater") {
    try {
      await trpcClient.account.wishlist.remove.mutate({ variantId });
      if (list === "wishlist") {
        setWishlist((prev) => prev.filter((i) => i.variantId !== variantId));
      } else {
        setSavedForLater((prev) => prev.filter((i) => i.variantId !== variantId));
      }
    } catch {
      toast({ title: "Couldn't remove item", variant: "error" });
    }
  }

  function handleMoveToBag(item: WishlistItem) {
    addLine({
      variantId: item.variantId,
      productSlug: item.productSlug,
      productName: item.productName,
      variantLabel: item.variantLabel,
      unitPrice: item.price,
      currency: item.currency,
      imageUrl: item.image?.url ?? null,
    });
    void handleRemove(item.variantId, "savedForLater");
    toast({ title: "Moved to bag" });
  }

  if (wishlist.length === 0 && savedForLater.length === 0) {
    return (
      <EmptyState title="Your wishlist is empty" description="Items you save will appear here." />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        {wishlist.map((item) => (
          <WishlistRow
            key={item.id}
            item={item}
            onRemove={() => void handleRemove(item.variantId, "wishlist")}
          />
        ))}
      </div>

      {savedForLater.length > 0 ? (
        <div>
          <h2 className="font-display text-ink mb-4 text-lg">Saved for later</h2>
          {savedForLater.map((item) => (
            <WishlistRow
              key={item.id}
              item={item}
              onRemove={() => void handleRemove(item.variantId, "savedForLater")}
              onMoveToBag={() => {
                handleMoveToBag(item);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
