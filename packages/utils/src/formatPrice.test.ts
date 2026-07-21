import { describe, expect, it } from "vitest";
import { formatPriceForDisplay, parsePriceToMinorUnits } from "./formatPrice";

describe("formatPriceForDisplay", () => {
  it("formats whole-dollar minor units", () => {
    expect(formatPriceForDisplay(42000)).toBe("$420.00");
  });

  it("formats zero", () => {
    expect(formatPriceForDisplay(0)).toBe("$0.00");
  });

  it("formats sub-dollar minor units", () => {
    expect(formatPriceForDisplay(5)).toBe("$0.05");
  });

  it("formats a non-USD currency", () => {
    expect(formatPriceForDisplay(10000, "EUR")).toBe("€100.00");
  });

  it("formats negative minor units (refund/adjustment display)", () => {
    expect(formatPriceForDisplay(-500)).toBe("-$5.00");
  });
});

describe("parsePriceToMinorUnits", () => {
  it("parses a plain integer string", () => {
    expect(parsePriceToMinorUnits("420")).toBe(42000);
  });

  it("parses a decimal string", () => {
    expect(parsePriceToMinorUnits("420.5")).toBe(42050);
  });

  it("strips a currency symbol", () => {
    expect(parsePriceToMinorUnits("$420.00")).toBe(42000);
  });

  it("rounds to the nearest cent", () => {
    expect(parsePriceToMinorUnits("12.345")).toBe(1235);
  });

  it("returns null for an empty string", () => {
    expect(parsePriceToMinorUnits("")).toBeNull();
  });

  it("returns null for input with no digits", () => {
    expect(parsePriceToMinorUnits("abc")).toBeNull();
  });

  it("strips a leading minus sign rather than producing a negative amount", () => {
    // The digit-stripping regex removes "-" along with every non [0-9.]
    // character, so "-5" is sanitized to "5" — negative prices can't be
    // entered this way, they just silently become positive.
    expect(parsePriceToMinorUnits("-5")).toBe(500);
  });

  it("parses only the leading valid float when a second decimal point appears", () => {
    expect(parsePriceToMinorUnits("4.2.0")).toBe(420);
  });
});
