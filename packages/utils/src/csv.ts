/** Minimal RFC 4180-ish CSV serializer — no dependency needed for something this small. Quotes any field containing a comma, quote, or newline, doubling internal quotes. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});

  function escapeCell(value: string | number): string {
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}
