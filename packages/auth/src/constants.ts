// AUTHENTICATION.md §2.2 — short-lived access token, long-lived refresh token.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const ADMIN_ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // AUTHENTICATION.md §3 — shorter admin lifetime
export const ADMIN_REFRESH_TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export const ACCESS_TOKEN_COOKIE = "silonya_at";
export const REFRESH_TOKEN_COOKIE = "silonya_rt";
export const ADMIN_ACCESS_TOKEN_COOKIE = "silonya_admin_at";
export const ADMIN_REFRESH_TOKEN_COOKIE = "silonya_admin_rt";

/** Shared cookie attributes — httpOnly/Secure/SameSite, never readable by client JS (AUTHENTICATION.md §2.2). */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
