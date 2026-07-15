"use client";

import { useEffect } from "react";
import { useIsLoggedIn } from "@/lib/customer-session-client";
import { trpcClient } from "@/lib/trpc-client";

/** CUSTOMER EXPERIENCE — records a product view for signed-in customers (account.recentlyViewed, DATABASE_ARCHITECTURE.md's RecentlyViewed). Renders nothing; guests get no persisted history (matches the pre-account cart/wishlist pattern). */
export function RecentlyViewedTracker({ productId }: { productId: string }) {
  const loggedIn = useIsLoggedIn();

  useEffect(() => {
    if (!loggedIn) return;
    trpcClient.account.recentlyViewed.track.mutate({ productId }).catch(() => undefined);
  }, [loggedIn, productId]);

  return null;
}
