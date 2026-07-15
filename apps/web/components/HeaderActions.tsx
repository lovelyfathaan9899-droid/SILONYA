"use client";

import { useEffect, useState } from "react";
import { Search, ShoppingBag, User } from "lucide-react";
import { CartDrawer, Icon, SearchPalette, ThemeToggle, type SearchResult } from "@silonya/ui";
import Link from "next/link";
import { useCartCount, useCartStore } from "@/lib/stores/cartStore";
import { useIsLoggedIn } from "@/lib/customer-session-client";

interface SearchResponse {
  results: SearchResult[];
}

/**
 * Header's right-side action cluster: theme toggle, search (opens
 * SearchPalette, debounced fetch to /api/search), and bag (opens CartDrawer,
 * driven by the global cart store so "Add to bag" on the PDP can pop it open
 * too). Rendered as one client island inside Header's `actions` slot.
 */
export function HeaderActions() {
  const loggedIn = useIsLoggedIn();
  const cartCount = useCartCount();
  const cartOpen = useCartStore((state) => state.isOpen);
  const cartLines = useCartStore((state) => state.lines);
  const openCart = useCartStore((state) => state.open);
  const closeCart = useCartStore((state) => state.close);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!searchOpen || query.trim().length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json() as Promise<SearchResponse>)
        .then((data) => {
          if (!cancelled) setResults(data.results);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchOpen]);

  return (
    <>
      <ThemeToggle />

      <Link
        href={loggedIn ? "/account" : "/login"}
        aria-label={loggedIn ? "Your account" : "Sign in"}
        className="text-ink focus-visible:ring-ink flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Icon icon={User} size={20} />
      </Link>

      <button
        type="button"
        aria-label="Search"
        onClick={() => {
          setSearchOpen(true);
        }}
        className="text-ink focus-visible:ring-ink flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Icon icon={Search} size={20} />
      </button>

      <button
        type="button"
        aria-label={`Bag, ${String(cartCount)} item${cartCount === 1 ? "" : "s"}`}
        onClick={openCart}
        className="text-ink focus-visible:ring-ink relative flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Icon icon={ShoppingBag} size={20} />
        {cartCount > 0 ? (
          <span className="bg-ink absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-sans text-[10px] text-white">
            {cartCount}
          </span>
        ) : null}
      </button>

      <SearchPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        query={query}
        onQueryChange={setQuery}
        results={results}
        isLoading={isLoading}
        onResultClick={() => {
          setSearchOpen(false);
        }}
      />

      <CartDrawer
        open={cartOpen}
        onOpenChange={(open) => {
          if (open) {
            openCart();
          } else {
            closeCart();
          }
        }}
        lines={cartLines}
        onQuantityChange={setQuantity}
        onRemove={removeLine}
      />
    </>
  );
}
