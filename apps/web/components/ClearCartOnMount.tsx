"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/stores/cartStore";

/** Fires once a checkout completes and the confirmation page renders — the local pre-checkout cart no longer represents anything real. */
export function ClearCartOnMount() {
  const clear = useCartStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
