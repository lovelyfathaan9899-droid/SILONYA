import type { OrderEmailData } from "@silonya/emails";

interface OrderForEmail {
  orderNumber: string;
  guestEmail: string | null;
  currency: string;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  items: {
    productNameSnapshot: string;
    variantLabelSnapshot: string;
    quantity: number;
    lineTotal: number;
  }[];
  shippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    countryCode: string;
  };
}

/** Maps a Prisma Order (with items/shippingAddress included) into the plain shape packages/emails' templates expect — the one place that mapping happens, so the webhook handler and admin-triggered resends never drift apart. */
export function toOrderEmailData(
  order: OrderForEmail,
  orderTrackingUrl: string,
): OrderEmailData | null {
  if (!order.guestEmail) return null;

  return {
    orderNumber: order.orderNumber,
    guestEmail: order.guestEmail,
    currency: order.currency,
    subtotal: order.subtotal,
    shippingTotal: order.shippingTotal,
    taxTotal: order.taxTotal,
    discountTotal: order.discountTotal,
    grandTotal: order.grandTotal,
    items: order.items.map((item) => ({
      productNameSnapshot: item.productNameSnapshot,
      variantLabelSnapshot: item.variantLabelSnapshot,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    shippingAddress: {
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2,
      city: order.shippingAddress.city,
      region: order.shippingAddress.region,
      postalCode: order.shippingAddress.postalCode,
      countryCode: order.shippingAddress.countryCode,
    },
    orderTrackingUrl,
  };
}
