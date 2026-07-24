/**
 * Checkout's country + phone dial-code lists (CHECKOUT_ARCHITECTURE —
 * Pakistan launch). Pakistan is first and is the default; the rest cover
 * the largest overseas Pakistani communities (UAE/Gulf, UK, US) an
 * ecommerce brand here would realistically ship to or take orders from.
 * Add more entries here as real demand shows up — never per-component.
 */
export interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: "PK", name: "Pakistan", dialCode: "+92" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "US", name: "United States", dialCode: "+1" },
  { code: "CA", name: "Canada", dialCode: "+1" },
];

export const DEFAULT_COUNTRY_CODE = "PK";

export interface DialCodeOption {
  dialCode: string;
  label: string;
}

/**
 * A phone dial-code Select needs one entry per unique dial code, not one per
 * COUNTRIES row — US and Canada both dial as "+1", and rendering both as
 * separate options with the same `value` produces duplicate keys in Radix
 * Select's internal native-<option> mirroring (a real, reproduced console
 * error, not just a lint nit). Countries sharing a dial code are merged
 * into a single option labeled with all their names.
 */
export const DIAL_CODES: DialCodeOption[] = Object.values(
  COUNTRIES.reduce<Record<string, { dialCode: string; names: string[] }>>((acc, country) => {
    const entry = acc[country.dialCode] ?? { dialCode: country.dialCode, names: [] };
    entry.names.push(country.name);
    acc[country.dialCode] = entry;
    return acc;
  }, {}),
).map((entry) => ({
  dialCode: entry.dialCode,
  label: `${entry.dialCode} (${entry.names.join(" / ")})`,
}));

/** Pakistan's provinces and territories — shown as a dropdown only when the selected country is Pakistan; any other country falls back to a plain "Province / State / Region" text field, since province naming conventions don't generalize. */
export const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
];
