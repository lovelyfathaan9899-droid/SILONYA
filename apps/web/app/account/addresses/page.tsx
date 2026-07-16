import type { Metadata } from "next";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";
import { AddressesManager } from "./AddressesManager";

export const metadata: Metadata = { title: "Addresses", robots: { index: false, follow: false } };

export default async function AddressesPage() {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  const [addresses, profile] = await Promise.all([
    caller.account.addresses.list(),
    caller.account.profile.get(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-ink text-2xl">Addresses</h1>
      <AddressesManager
        initialAddresses={addresses}
        defaultShippingAddressId={profile.defaultShippingAddressId}
        defaultBillingAddressId={profile.defaultBillingAddressId}
      />
    </div>
  );
}
