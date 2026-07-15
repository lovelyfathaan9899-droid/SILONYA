import "server-only";

import type { Context } from "@silonya/api";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@silonya/auth";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Reads and verifies the current customer session from request cookies
 * (Server Components/Actions only). Wrapped in React's `cache()` — mirrors
 * apps/admin/lib/admin-context.ts's getAdminContext for the customer domain
 * (AUTHENTICATION.md §1 — two separate identity domains).
 */
export const getCustomerContext = cache(async (): Promise<Context> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return { adminSession: null, customerSession: null };

  const payload = await verifyAccessToken(token);
  if (!payload || payload.role) return { adminSession: null, customerSession: null };

  return {
    adminSession: null,
    customerSession: { userId: payload.sub, sessionId: payload.sid },
  };
});
