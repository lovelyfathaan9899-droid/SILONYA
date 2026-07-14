import { createHash, randomBytes } from "node:crypto";

// Uses Node's crypto module — never import this from edge-runtime code
// (Next.js Middleware). See ./edge.ts, which deliberately does not
// re-export anything from this file.

/** Raw refresh token (sent to the client in an httpOnly cookie) + its hash (stored in the database — DATABASE_ARCHITECTURE.md §3.1, never the raw value). */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
