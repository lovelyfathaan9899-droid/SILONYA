import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, PriceDisplay, Section } from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import { ClearCartOnMount } from "@/components/ClearCartOnMount";
import { PendingOrderRefresh } from "@/components/PendingOrderRefresh";
import { createServerCaller } from "@/lib/trpc-caller";

// Contains order/address detail behind a signed access token — never indexed.
export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Finalizing your order…",
  paid: "Confirmed",
  processing: "Being prepared",
  shipped: "Shipped",
  delivered: "Delivered",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export default async function OrderConfirmationPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) {
    notFound();
  }

  const caller = createServerCaller();
  const order = await caller.checkout.getOrderByToken({ token }).catch(() => null);
  if (!order) {
    notFound();
  }

  const isPending = order.status === "pending_payment";

  return (
    <Section spacing="lg">
      {order.status === "paid" ? <ClearCartOnMount /> : null}
      {isPending ? <PendingOrderRefresh /> : null}

      <div className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-ink text-3xl md:text-4xl">
          {isPending ? "Almost there" : "Thank you for your order"}
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-stone font-sans text-sm">Order {order.orderNumber}</p>
          <Badge>{STATUS_LABEL[order.status] ?? order.status}</Badge>
        </div>
        {isPending ? (
          <p className="text-stone font-sans text-sm">
            We&apos;re confirming your payment — this page will update automatically.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ul className="flex flex-col gap-4">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="border-mist text-ink flex justify-between border-b pb-4 font-sans text-sm"
              >
                <span>
                  {item.productNameSnapshot}
                  {item.variantLabelSnapshot ? ` (${item.variantLabelSnapshot})` : ""} ×{" "}
                  {item.quantity}
                </span>
                <PriceDisplay price={item.lineTotal} currency={order.currency} />
              </li>
            ))}
          </ul>
        </div>

        <div className="border-mist flex flex-col gap-3 border p-6">
          <div className="text-ink flex justify-between font-sans text-sm">
            <span>Subtotal</span>
            <PriceDisplay price={order.subtotal} currency={order.currency} />
          </div>
          <div className="text-ink flex justify-between font-sans text-sm">
            <span>Shipping</span>
            <PriceDisplay price={order.shippingTotal} currency={order.currency} />
          </div>
          {order.taxTotal > 0 ? (
            <div className="text-ink flex justify-between font-sans text-sm">
              <span>Tax</span>
              <PriceDisplay price={order.taxTotal} currency={order.currency} />
            </div>
          ) : null}
          {order.discountTotal > 0 ? (
            <div className="text-ink flex justify-between font-sans text-sm">
              <span>Discount</span>
              <span>-{formatPriceForDisplay(order.discountTotal, order.currency)}</span>
            </div>
          ) : null}
          <hr className="border-mist" />
          <div className="text-ink flex justify-between font-sans text-base font-medium">
            <span>Total</span>
            <PriceDisplay price={order.grandTotal} currency={order.currency} />
          </div>

          <hr className="border-mist" />
          <p className="text-stone font-sans text-xs uppercase tracking-wide">Shipping to</p>
          <p className="text-ink font-sans text-sm">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.region ?? ""}{" "}
            {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.countryCode}
          </p>
        </div>
      </div>
    </Section>
  );
}
