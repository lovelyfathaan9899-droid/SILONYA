import { Badge, Card, CardContent, CardHeader, CardTitle } from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountOverviewPage() {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);

  const [session, recentOrders, wishlist] = await Promise.all([
    caller.customerAuth.session(),
    caller.account.orders.list({ limit: 5 }),
    caller.account.wishlist.list(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-ink text-3xl">
          Welcome{session.firstName ? `, ${session.firstName}` : ""}
        </h1>
        {!session.emailVerifiedAt ? (
          <p className="text-stone mt-2 font-sans text-sm">
            Your email isn&apos;t verified yet.{" "}
            <Link href="/account/settings" className="text-ink underline">
              Resend verification
            </Link>
            .
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.items.length === 0 ? (
              <p className="text-stone font-sans text-sm">No orders yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recentOrders.items.map((order) => (
                  <li key={order.id} className="flex items-center justify-between">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="text-ink font-sans text-sm underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{order.status.replace(/_/g, " ")}</Badge>
                      <span className="text-ink font-sans text-sm">
                        {formatPriceForDisplay(order.grandTotal, order.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/account/orders"
              className="text-ink mt-4 inline-block font-sans text-sm underline"
            >
              View all orders
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wishlist</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-stone font-sans text-sm">
              {wishlist.wishlist.length} item{wishlist.wishlist.length === 1 ? "" : "s"} saved
            </p>
            <Link
              href="/account/wishlist"
              className="text-ink mt-4 inline-block font-sans text-sm underline"
            >
              View wishlist
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
