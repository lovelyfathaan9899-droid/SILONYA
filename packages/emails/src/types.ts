// Deliberately decoupled from Prisma's generated Order type — this package
// only renders whatever plain data it's given (packages/api's webhook
// handling maps the Order row into this shape before calling send*Email).
// Keeps packages/emails free of a @silonya/database dependency.
export interface OrderEmailData {
  orderNumber: string;
  guestEmail: string;
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
    postalCode: string;
    countryCode: string;
  };
  orderTrackingUrl: string;
}
