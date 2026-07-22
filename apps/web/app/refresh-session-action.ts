"use server";

import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  sessionCookieOptions,
} from "@silonya/auth";
import { cookies } from "next/headers";
import { createServerCaller } from "@/lib/trpc-caller";

/**
 * Called proactively by components/SessionRefresher.tsx (mounted once in
 * AppShell) shortly before the 15-minute access token would expire —
 * AUTHENTICATION.md §2.2's "silent client-side refresh flow before expiry,"
 * which nothing previously implemented: rotateCustomerSession existed but
 * was never called from anywhere, so customers were silently logged out
 * every 15 minutes of session age regardless of activity. Not gated on an
 * existing customer session (deliberately `createServerCaller()` with no
 * ctx) — the whole point is issuing a new access token once the old one
 * has already expired. No-ops quietly on any failure (missing/expired
 * refresh token, revoked session) rather than surfacing an error — the
 * next real customerProcedure call will hit its own UNAUTHORIZED path if
 * the session is genuinely gone; this action's only job is to extend a
 * still-valid one.
 */
export async function refreshSessionAction(): Promise<{ refreshed: boolean }> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return { refreshed: false };
  }

  try {
    const caller = createServerCaller();
    const result = await caller.customerAuth.refresh({ refreshToken });

    cookieStore.set(
      ACCESS_TOKEN_COOKIE,
      result.tokens.accessToken,
      sessionCookieOptions(ACCESS_TOKEN_TTL_SECONDS),
    );
    cookieStore.set(
      REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      sessionCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
    );
    return { refreshed: true };
  } catch {
    return { refreshed: false };
  }
}
