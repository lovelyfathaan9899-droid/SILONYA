import { describe, expect, it } from "vitest";
import {
  calculateDiscountAmount,
  calculateShipping,
  calculateTax,
  generateOrderNumber,
} from "./order";

describe("generateOrderNumber", () => {
  it("matches the SIL-###### format", () => {
    expect(generateOrderNumber()).toMatch(/^SIL-\d{6}$/);
  });

  it("stays within the documented six-digit range across many draws", () => {
    for (let i = 0; i < 200; i++) {
      const [, digits] = generateOrderNumber().split("-");
      const n = Number(digits);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});

describe("calculateShipping", () => {
  it("charges the flat rate below the free-shipping threshold", () => {
    expect(calculateShipping(19999, false)).toBe(1000);
  });

  it("is free at exactly the threshold", () => {
    expect(calculateShipping(20000, false)).toBe(0);
  });

  it("is free above the threshold", () => {
    expect(calculateShipping(50000, false)).toBe(0);
  });

  it("is free when overridden regardless of subtotal", () => {
    expect(calculateShipping(0, true)).toBe(0);
  });
});

describe("calculateTax", () => {
  it("applies the flat US rate", () => {
    expect(calculateTax(10000, "US")).toBe(800);
  });

  it("is case-insensitive on country code", () => {
    expect(calculateTax(10000, "us")).toBe(800);
  });

  it("rounds to the nearest minor unit", () => {
    expect(calculateTax(999, "US")).toBe(80);
  });

  it("is zero for a country with no configured rate", () => {
    expect(calculateTax(10000, "FR")).toBe(0);
  });
});

describe("calculateDiscountAmount", () => {
  it("computes a percentage discount, rounded", () => {
    expect(calculateDiscountAmount({ type: "percentage", value: 10 }, 10000)).toBe(1000);
    expect(calculateDiscountAmount({ type: "percentage", value: 10 }, 333)).toBe(33);
  });

  it("computes a fixed-amount discount", () => {
    expect(calculateDiscountAmount({ type: "fixed_amount", value: 500 }, 10000)).toBe(500);
  });

  it("never lets a fixed-amount discount exceed the subtotal", () => {
    expect(calculateDiscountAmount({ type: "fixed_amount", value: 15000 }, 10000)).toBe(10000);
  });

  it("returns zero for free_shipping (applied via calculateShipping instead)", () => {
    expect(calculateDiscountAmount({ type: "free_shipping", value: 100 }, 10000)).toBe(0);
  });
});
