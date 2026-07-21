import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Wool Overcoat")).toBe("wool-overcoat");
  });

  it("strips diacritics", () => {
    expect(slugify("Édition Café")).toBe("edition-cafe");
  });

  it("collapses runs of non-alphanumeric characters into one hyphen", () => {
    expect(slugify("Women's  &  Kids!!")).toBe("women-s-kids");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Autumn 2026--  ")).toBe("autumn-2026");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
