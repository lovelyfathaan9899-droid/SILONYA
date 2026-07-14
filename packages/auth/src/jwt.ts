import { jwtVerify, SignJWT } from "jose";

// jose uses Web Crypto (no `node:` built-ins) — safe to import from Next.js
// Middleware (Edge Runtime), unlike refresh-token.ts (see that file).
function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

export interface AccessTokenPayload {
  sub: string; // user id
  sid: string; // session id
  role?: string; // admin role name, only present for admin sessions
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ sid: payload.sid, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(authSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }
    const base = { sub: payload.sub, sid: payload.sid };
    return typeof payload.role === "string" ? { ...base, role: payload.role } : base;
  } catch {
    return null;
  }
}
