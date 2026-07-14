import { ADMIN_ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@silonya/auth";

export interface AdminSessionContext {
  userId: string;
  sessionId: string;
  role: string;
}

export interface Context {
  adminSession: AdminSessionContext | null;
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Builds per-request tRPC context from the incoming cookies. Only verifies
 * the JWT signature/expiry here — anything requiring a specific permission
 * is enforced by procedure-level middleware (trpc.ts), not here
 * (API_SPECIFICATION.md §2).
 */
export async function createContext({ req }: { req: Request }): Promise<Context> {
  const cookies = parseCookies(req.headers.get("cookie") ?? "");
  const adminToken = cookies[ADMIN_ACCESS_TOKEN_COOKIE];

  let adminSession: AdminSessionContext | null = null;
  if (adminToken) {
    const payload = await verifyAccessToken(adminToken);
    if (payload?.role) {
      adminSession = { userId: payload.sub, sessionId: payload.sid, role: payload.role };
    }
  }

  return { adminSession };
}
