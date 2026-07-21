import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@silonya/database";
import {
  findAutomaticDiscount,
  toAddressCreateInput,
  validateDiscountCode,
  variantLabel,
} from "./shared";

vi.mock("@silonya/database", () => ({
  prisma: {
    discount: { findUnique: vi.fn(), findMany: vi.fn() },
    discountRedemption: { count: vi.fn() },
  },
}));

interface DiscountRow {
  id: string;
  code: string | null;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  minimumSubtotal: number | null;
  createdAt: Date;
  eligibility: { discountId: string; userId: string }[];
}

function makeDiscount(overrides: Partial<DiscountRow> = {}): DiscountRow {
  return {
    id: "discount-1",
    code: "SAVE10",
    type: "percentage",
    value: 10,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    perUserLimit: null,
    minimumSubtotal: null,
    createdAt: new Date("2026-01-01"),
    eligibility: [],
    ...overrides,
  };
}

describe("variantLabel", () => {
  it("joins option values with a slash", () => {
    const label = variantLabel([
      { productOptionValue: { value: "S" } },
      { productOptionValue: { value: "Black" } },
    ]);
    expect(label).toBe("S / Black");
  });

  it("returns an empty string for a variant with no option values", () => {
    expect(variantLabel([])).toBe("");
  });
});

describe("toAddressCreateInput", () => {
  it("maps omitted optional fields to null", () => {
    const result = toAddressCreateInput({
      line1: "1 Market St",
      city: "San Francisco",
      postalCode: "94105",
      countryCode: "US",
    });
    expect(result).toEqual({
      line1: "1 Market St",
      line2: null,
      city: "San Francisco",
      region: null,
      postalCode: "94105",
      countryCode: "US",
      phone: null,
      userId: null,
    });
  });

  it("attaches userId for a logged-in customer's address", () => {
    const result = toAddressCreateInput(
      { line1: "1 Market St", city: "SF", postalCode: "94105", countryCode: "US" },
      "user-1",
    );
    expect(result.userId).toBe("user-1");
  });
});

describe("validateDiscountCode", () => {
  beforeEach(() => {
    vi.mocked(prisma.discount.findUnique).mockReset();
    vi.mocked(prisma.discountRedemption.count).mockReset();
  });

  it("rejects a code that doesn't exist", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(null);
    await expect(validateDiscountCode("NOPE", 10000)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "That discount code isn't valid.",
    });
  });

  it("rejects a code that isn't active yet", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(makeDiscount({ startsAt: future }));
    await expect(validateDiscountCode("SAVE10", 10000)).rejects.toMatchObject({
      message: "That discount code isn't active yet.",
    });
  });

  it("rejects an expired code", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(makeDiscount({ endsAt: past }));
    await expect(validateDiscountCode("SAVE10", 10000)).rejects.toMatchObject({
      message: "That discount code has expired.",
    });
  });

  it("rejects when the subtotal is below the minimum", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(
      makeDiscount({ minimumSubtotal: 20000 }),
    );
    await expect(validateDiscountCode("SAVE10", 10000)).rejects.toMatchObject({
      message: "Your order doesn't meet the minimum for this code.",
    });
  });

  it("rejects a customer-specific code for a guest", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(
      makeDiscount({ eligibility: [{ discountId: "discount-1", userId: "user-1" }] }),
    );
    await expect(validateDiscountCode("SAVE10", 10000)).rejects.toMatchObject({
      message: "That discount code isn't valid for your account.",
    });
  });

  it("rejects a customer-specific code for the wrong logged-in user", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(
      makeDiscount({ eligibility: [{ discountId: "discount-1", userId: "user-1" }] }),
    );
    await expect(validateDiscountCode("SAVE10", 10000, "user-2")).rejects.toMatchObject({
      message: "That discount code isn't valid for your account.",
    });
  });

  it("accepts a customer-specific code for the eligible user", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(
      makeDiscount({ eligibility: [{ discountId: "discount-1", userId: "user-1" }] }),
    );
    const result = await validateDiscountCode("SAVE10", 10000, "user-1");
    expect(result.amount).toBe(1000);
  });

  it("rejects when the global usage limit is reached", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(makeDiscount({ usageLimit: 5 }));
    vi.mocked(prisma.discountRedemption.count).mockResolvedValueOnce(5);
    await expect(validateDiscountCode("SAVE10", 10000)).rejects.toMatchObject({
      message: "That discount code has been fully redeemed.",
    });
  });

  it("rejects when the per-user limit is reached for a logged-in user", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(makeDiscount({ perUserLimit: 1 }));
    vi.mocked(prisma.discountRedemption.count).mockResolvedValueOnce(1);
    await expect(validateDiscountCode("SAVE10", 10000, "user-1")).rejects.toMatchObject({
      message: "You've already used this discount code the maximum number of times.",
    });
  });

  it("does not apply a per-user limit to a guest (no durable identity)", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(makeDiscount({ perUserLimit: 1 }));
    const result = await validateDiscountCode("SAVE10", 10000);
    expect(result.amount).toBe(1000);
    expect(prisma.discountRedemption.count).not.toHaveBeenCalled();
  });

  it("uppercases and trims the code before lookup", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(makeDiscount());
    await validateDiscountCode("  save10  ", 10000);
    expect(prisma.discount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "SAVE10" } }),
    );
  });

  it("flags free_shipping discounts and returns a zero amount", async () => {
    vi.mocked(prisma.discount.findUnique).mockResolvedValueOnce(
      makeDiscount({ type: "free_shipping", value: 0 }),
    );
    const result = await validateDiscountCode("SAVE10", 10000);
    expect(result.freeShipping).toBe(true);
    expect(result.amount).toBe(0);
  });
});

describe("findAutomaticDiscount", () => {
  beforeEach(() => {
    vi.mocked(prisma.discount.findMany).mockReset();
    vi.mocked(prisma.discountRedemption.count).mockReset();
  });

  it("returns null when there are no automatic discounts", async () => {
    vi.mocked(prisma.discount.findMany).mockResolvedValueOnce([]);
    expect(await findAutomaticDiscount(10000)).toBeNull();
  });

  it("skips a candidate below its minimum subtotal", async () => {
    vi.mocked(prisma.discount.findMany).mockResolvedValueOnce([
      makeDiscount({ id: "d1", minimumSubtotal: 50000 }),
    ]);
    expect(await findAutomaticDiscount(10000)).toBeNull();
  });

  it("skips a candidate the current customer isn't eligible for", async () => {
    vi.mocked(prisma.discount.findMany).mockResolvedValueOnce([
      makeDiscount({ id: "d1", eligibility: [{ discountId: "d1", userId: "someone-else" }] }),
    ]);
    expect(await findAutomaticDiscount(10000, "user-1")).toBeNull();
  });

  it("picks the single eligible candidate", async () => {
    vi.mocked(prisma.discount.findMany).mockResolvedValueOnce([
      makeDiscount({ id: "d1", type: "percentage", value: 15 }),
    ]);
    const result = await findAutomaticDiscount(10000);
    expect(result?.id).toBe("d1");
    expect(result?.amount).toBe(1500);
  });

  it("picks the highest-value discount among multiple eligible candidates (non-stacking)", async () => {
    vi.mocked(prisma.discount.findMany).mockResolvedValueOnce([
      makeDiscount({ id: "d1", type: "percentage", value: 5 }),
      makeDiscount({ id: "d2", type: "percentage", value: 20 }),
      makeDiscount({ id: "d3", type: "fixed_amount", value: 300 }),
    ]);
    const result = await findAutomaticDiscount(10000);
    expect(result?.id).toBe("d2");
    expect(result?.amount).toBe(2000);
  });

  it("excludes a candidate that has hit its global usage limit", async () => {
    vi.mocked(prisma.discount.findMany).mockResolvedValueOnce([
      makeDiscount({ id: "d1", usageLimit: 1, type: "percentage", value: 50 }),
      makeDiscount({ id: "d2", type: "percentage", value: 5 }),
    ]);
    vi.mocked(prisma.discountRedemption.count).mockResolvedValueOnce(1);
    const result = await findAutomaticDiscount(10000);
    expect(result?.id).toBe("d2");
  });
});
