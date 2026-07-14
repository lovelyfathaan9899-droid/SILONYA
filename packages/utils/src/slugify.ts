// Unicode combining diacritical marks block (U+0300-U+036F) - matches the
// accent marks NFKD decomposition splits off (e.g. "e with acute accent"
// becomes a plain "e" plus a separate combining mark codepoint).
const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(input: string): string {
  let result = "";
  for (const char of input.normalize("NFKD")) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint < COMBINING_DIACRITICS_START || codePoint > COMBINING_DIACRITICS_END) {
      result += char;
    }
  }
  return result;
}

/**
 * Generates a URL-safe slug from a name (e.g. product/category/collection
 * titles). SEO_ARCHITECTURE.md §4 — slugs are kebab-case and, once
 * published, immutable; this is only ever used at creation time.
 */
export function slugify(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
