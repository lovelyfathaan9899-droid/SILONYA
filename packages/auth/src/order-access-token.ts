import { jwtVerify, SignJWT } from "jose";

// Guest order lookup (ORDER_MANAGEMENT.md §4) — no customer accounts exist
// yet, so a signed, expiring token (order id + email) is the entire access
// mechanism for the confirmation/tracking pages. Same jose/Web-Crypto
// approach as jwt.ts, kept as a separate token "shape" since it authorizes
// access to one order, not a login session.
const ORDER_ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — long enough to be useful post-purchase

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

export interface OrderAccessTokenPayload {
  orderId: string;
  email: string;
}

export async function signOrderAccessToken(payload: OrderAccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.orderId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ORDER_ACCESS_TOKEN_TTL_SECONDS)
    .sign(authSecret());
}

export async function verifyOrderAccessToken(
  token: string,
): Promise<OrderAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { orderId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
