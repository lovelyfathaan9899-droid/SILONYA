import "server-only";

import type { Context } from "@silonya/api";
import { ADMIN_ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@silonya/auth";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Reads and verifies the current admin session from the request cookies
 * (Server Components/Actions only). Wrapped in React's `cache()` so the
 * (app) layout and every page under it can each call this without
 * re-parsing cookies/re-verifying the JWT more than once per request.
 */
export const getAdminContext = cache(async (): Promise<Context> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return { adminSession: null, customerSession: null };

  const payload = await verifyAccessToken(token);
  if (!payload?.role) return { adminSession: null, customerSession: null };

  return {
    adminSession: { userId: payload.sub, sessionId: payload.sid, role: payload.role },
    customerSession: null,
  };
});
