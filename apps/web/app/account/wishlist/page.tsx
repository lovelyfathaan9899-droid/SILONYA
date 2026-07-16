import type { Metadata } from "next";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";
import { WishlistManager } from "./WishlistManager";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };

export default async function AccountWishlistPage() {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  const wishlist = await caller.account.wishlist.list();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-ink text-2xl">Wishlist</h1>
      <WishlistManager initial={wishlist} />
    </div>
  );
}
