import { describe, expect, it } from "vitest";
import { toOrderEmailData } from "./order-email-mapper";

function baseOrder(overrides: Partial<Parameters<typeof toOrderEmailData>[0]> = {}) {
  return {
    orderNumber: "SIL-483920",
    guestEmail: "shopper@example.com",
    currency: "USD",
    subtotal: 42000,
    shippingTotal: 1000,
    taxTotal: 3360,
    discountTotal: 0,
    grandTotal: 46360,
    items: [
      {
        productNameSnapshot: "Wool Overcoat",
        variantLabelSnapshot: "S / Black",
        quantity: 1,
        lineTotal: 42000,
      },
    ],
    shippingAddress: {
      line1: "1 Market St",
      line2: null,
      city: "San Francisco",
      region: "CA",
      postalCode: "94105",
      countryCode: "US",
    },
    ...overrides,
  };
}

describe("toOrderEmailData", () => {
  it("returns null when the order has no email to send to", () => {
    expect(
      toOrderEmailData(baseOrder({ guestEmail: null }), "https://example.com/track"),
    ).toBeNull();
  });

  it("maps every order field into the email template shape", () => {
    const result = toOrderEmailData(
      baseOrder(),
      "https://silonya.com/order/confirmation?token=abc",
    );

    expect(result).toEqual({
      orderNumber: "SIL-483920",
      guestEmail: "shopper@example.com",
      currency: "USD",
      subtotal: 42000,
      shippingTotal: 1000,
      taxTotal: 3360,
      discountTotal: 0,
      grandTotal: 46360,
      items: [
        {
          productNameSnapshot: "Wool Overcoat",
          variantLabelSnapshot: "S / Black",
          quantity: 1,
          lineTotal: 42000,
        },
      ],
      shippingAddress: {
        line1: "1 Market St",
        line2: null,
        city: "San Francisco",
        region: "CA",
        postalCode: "94105",
        countryCode: "US",
      },
      orderTrackingUrl: "https://silonya.com/order/confirmation?token=abc",
    });
  });

  it("passes through a null address line2/region rather than dropping them", () => {
    const result = toOrderEmailData(
      baseOrder({ shippingAddress: { ...baseOrder().shippingAddress, line2: null, region: null } }),
      "https://example.com/track",
    );
    expect(result?.shippingAddress.line2).toBeNull();
    expect(result?.shippingAddress.region).toBeNull();
  });
});
