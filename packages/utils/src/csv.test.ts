import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("serializes headers from the first row and CRLF-joins lines", () => {
    const csv = toCsv([
      { name: "Wool Overcoat", price: 42000 },
      { name: "Silk Slip Dress", price: 28000 },
    ]);
    expect(csv).toBe("name,price\r\nWool Overcoat,42000\r\nSilk Slip Dress,28000");
  });

  it("quotes and escapes a field containing a comma", () => {
    expect(toCsv([{ label: "Coats, Jackets" }])).toBe('label\r\n"Coats, Jackets"');
  });

  it("quotes and doubles internal quotes", () => {
    expect(toCsv([{ label: 'The "Essentials"' }])).toBe('label\r\n"The ""Essentials"""');
  });

  it("quotes a field containing a newline", () => {
    expect(toCsv([{ note: "line one\nline two" }])).toBe('note\r\n"line one\nline two"');
  });

  it("fills missing keys with an empty cell", () => {
    const csv = toCsv([{ a: "1", b: "2" }, { a: "3" }]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,");
  });
});
