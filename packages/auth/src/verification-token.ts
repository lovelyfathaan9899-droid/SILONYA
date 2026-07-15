import { prisma } from "@silonya/database";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token";

const PASSWORD_RESET_TTL_SECONDS = 15 * 60; // AUTHENTICATION.md §2.4 — 15 minutes, single-use
const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60; // AUTHENTICATION.md §2.3 — 24 hours

export type VerificationTokenKind = "password_reset" | "email_verification";

/**
 * Issues a single-use, expiring token (AUTHENTICATION.md §2.3, §2.4) — reuses
 * the same generateRefreshToken/hashRefreshToken pair as session refresh
 * tokens (packages/auth/src/refresh-token.ts) so only the hash is ever
 * persisted. Any unused, unexpired token of the same kind for this user is
 * invalidated first, so at most one live token per kind/user exists.
 */
export async function issueVerificationToken(
  userId: string,
  type: VerificationTokenKind,
): Promise<string> {
  const ttlSeconds =
    type === "password_reset" ? PASSWORD_RESET_TTL_SECONDS : EMAIL_VERIFICATION_TTL_SECONDS;

  await prisma.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { raw, hash } = generateRefreshToken();
  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    },
  });
  return raw;
}

/** Verifies and consumes a token — returns the userId on success, null on any invalid/expired/already-used token. Never throws on bad input (callers must not leak which case failed). */
export async function consumeVerificationToken(
  rawToken: string,
  type: VerificationTokenKind,
): Promise<string | null> {
  const hash = hashRefreshToken(rawToken);
  const token = await prisma.verificationToken.findUnique({ where: { tokenHash: hash } });

  if (!token) {
    return null;
  }
  if (token.type !== type || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await prisma.verificationToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return token.userId;
}
