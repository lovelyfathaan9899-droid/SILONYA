import { createHash } from "node:crypto";
import { zxcvbnAsync, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

let optionsConfigured = false;
function ensureOptions(): void {
  if (optionsConfigured) return;
  zxcvbnOptions.setOptions({
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  });
  optionsConfigured = true;
}

const MIN_LENGTH = 8;
const MIN_SCORE = 2; // zxcvbn score 0-4; AUTHENTICATION.md §2.3 "min score enforced"
const HIBP_TIMEOUT_MS = 3000;

export type PasswordCheckResult = { valid: true } | { valid: false; reason: string };

/**
 * HaveIBeenPwned range API (AUTHENTICATION.md §6) — k-anonymity model: only
 * the first 5 hex characters of the password's SHA-1 hash are ever sent,
 * never the password or the full hash, so HIBP can't learn the actual
 * password from this request. Fails open (treats the password as
 * not-breached) on any network error/timeout/non-2xx response — an HIBP
 * outage should never block registration or password reset, since zxcvbn's
 * strength check above already provides a baseline regardless.
 */
async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body.split("\n").some((line) => line.trim().startsWith(suffix));
  } catch {
    return false;
  }
}

/** Password strength validation (AUTHENTICATION.md §2.3, §6) — zxcvbn-based, min score enforced, plus a breached-password check, ahead of argon2id hashing. */
export async function checkPasswordStrength(
  password: string,
  userInputs: string[] = [],
): Promise<PasswordCheckResult> {
  if (password.length < MIN_LENGTH) {
    return { valid: false, reason: `Password must be at least ${String(MIN_LENGTH)} characters.` };
  }
  ensureOptions();
  const result = await zxcvbnAsync(password, userInputs);
  if (result.score < MIN_SCORE) {
    const suggestion = result.feedback.suggestions[0];
    return {
      valid: false,
      reason: suggestion ?? "This password is too weak. Try a longer, less predictable phrase.",
    };
  }
  if (await isPasswordBreached(password)) {
    return {
      valid: false,
      reason: "This password has appeared in a known data breach. Please choose a different one.",
    };
  }
  return { valid: true };
}
