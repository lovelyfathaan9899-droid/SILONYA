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
  it("charges the standard flat rate below the free-shipping threshold", () => {
    expect(calculateShipping(499999, "standard", false)).toBe(25000);
  });

  it("is free (standard) at exactly the threshold", () => {
    expect(calculateShipping(500000, "standard", false)).toBe(0);
  });

  it("is free (standard) above the threshold", () => {
    expect(calculateShipping(900000, "standard", false)).toBe(0);
  });

  it("express is a flat rate regardless of subtotal, never free by threshold", () => {
    expect(calculateShipping(0, "express", false)).toBe(50000);
    expect(calculateShipping(900000, "express", false)).toBe(50000);
  });

  it("is free when overridden regardless of subtotal or method", () => {
    expect(calculateShipping(0, "standard", true)).toBe(0);
    expect(calculateShipping(0, "express", true)).toBe(0);
  });
});

describe("calculateTax", () => {
  it("is zero for every country — no tax rate configured for Pakistan launch", () => {
    expect(calculateTax(10000, "PK")).toBe(0);
    expect(calculateTax(10000, "US")).toBe(0);
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
