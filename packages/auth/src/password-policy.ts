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

export type PasswordCheckResult = { valid: true } | { valid: false; reason: string };

/** Password strength validation (AUTHENTICATION.md §2.3, §6) — zxcvbn-based, min score enforced, ahead of argon2id hashing. */
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
  return { valid: true };
}
