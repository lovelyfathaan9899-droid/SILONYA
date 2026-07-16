import { ADMIN_ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@silonya/auth/edge";
import { NextResponse, type NextRequest } from "next/server";

// Runs on the Edge Runtime — only verifies the JWT signature/expiry
// (AUTHENTICATION.md §3, §6). This is the first line of defense, not the
// only one: every adminProcedure re-checks the session server-side
// (packages/api/src/trpc.ts), and permission-gated procedures re-check
// RBAC against the database (SECURITY_ARCHITECTURE.md §1, defense in depth).
const PUBLIC_PATHS = ["/login", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/trpc|_next/static|_next/image|favicon.ico).*)"],
};
