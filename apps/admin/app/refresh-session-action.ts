"use server";

import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_TTL_SECONDS,
  sessionCookieOptions,
} from "@silonya/auth";
import { cookies } from "next/headers";
import { createServerCaller } from "@/lib/trpc-caller";

/**
 * Mirrors apps/web/app/refresh-session-action.ts — see that file's doc
 * comment for why this exists (AUTHENTICATION.md §2.2's silent refresh,
 * previously unimplemented for either app). Called proactively by
 * components/SessionRefresher.tsx before the 1-hour admin access token
 * would expire; without it, (app)/layout.tsx's `if (!ctx.adminSession)
 * redirect("/login")` check would boot an active admin to the login page
 * on their very next navigation once the hour was up, even with a
 * perfectly valid 8-hour refresh token sitting unused in its cookie.
 */
export async function refreshSessionAction(): Promise<{ refreshed: boolean }> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return { refreshed: false };
  }

  try {
    const caller = createServerCaller({ adminSession: null, customerSession: null });
    const result = await caller.adminAuth.refresh({ refreshToken });

    cookieStore.set(
      ADMIN_ACCESS_TOKEN_COOKIE,
      result.tokens.accessToken,
      sessionCookieOptions(ADMIN_ACCESS_TOKEN_TTL_SECONDS),
    );
    cookieStore.set(
      ADMIN_REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      sessionCookieOptions(ADMIN_REFRESH_TOKEN_TTL_SECONDS),
    );
    return { refreshed: true };
  } catch {
    return { refreshed: false };
  }
}
