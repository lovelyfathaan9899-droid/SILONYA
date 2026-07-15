import { Badge, PriceDisplay } from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";

export const metadata: Metadata = { title: "Order details" };

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Finalizing your order…",
  payment_failed: "Payment failed",
  paid: "Confirmed",
  processing: "Being prepared",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  const order = await caller.account.orders.detail({ id }).catch(() => null);
  if (!order) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-ink text-2xl">Order {order.orderNumber}</h1>
        <div className="mt-2 flex items-center gap-3">
          <Badge>{STATUS_LABEL[order.status] ?? order.status}</Badge>
          {order.trackingNumber ? (
            <span className="text-stone font-sans text-sm">
              Tracking: {order.trackingNumber} {order.carrier ? `(${order.carrier})` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
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

          <div>
            <h2 className="font-display text-ink mb-3 text-lg">Tracking</h2>
            <ul className="flex flex-col gap-2">
              {order.statusEvents.map((event) => (
                <li key={event.id} className="text-stone font-sans text-sm">
                  {new Date(event.createdAt).toLocaleString()} —{" "}
                  {STATUS_LABEL[event.status] ?? event.status}
                </li>
              ))}
            </ul>
          </div>
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
          {order.giftCardTotal > 0 ? (
            <div className="text-ink flex justify-between font-sans text-sm">
              <span>Gift card</span>
              <span>-{formatPriceForDisplay(order.giftCardTotal, order.currency)}</span>
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
    </div>
  );
}
