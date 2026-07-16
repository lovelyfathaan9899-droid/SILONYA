import { Badge, EmptyState } from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";

export const metadata: Metadata = {
  title: "Order history",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  const { items } = await caller.account.orders.list({ limit: 50 });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-ink text-2xl">Order history</h1>
      {items.length === 0 ? (
        <EmptyState title="No orders yet" description="Your past orders will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="border-mist hover:border-ink flex items-center justify-between border p-4"
            >
              <div>
                <p className="text-ink font-sans text-sm font-medium">{order.orderNumber}</p>
                <p className="text-stone font-sans text-xs">
                  {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} item
                  {order.itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{order.status.replace(/_/g, " ")}</Badge>
                <span className="text-ink font-sans text-sm">
                  {formatPriceForDisplay(order.grandTotal, order.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
