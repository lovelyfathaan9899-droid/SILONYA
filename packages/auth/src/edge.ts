// Edge-runtime-safe subset of this package — no @silonya/database (Prisma)
// import in this module's graph, so it's safe to import from Next.js
// Middleware (apps/admin/middleware.ts), which runs on the Edge Runtime and
// cannot use Node.js APIs or a Prisma client. Middleware only verifies the
// JWT signature; real session/permission checks against the database still
// happen server-side in the actual route/procedure (defense in depth,
// SECURITY_ARCHITECTURE.md §1).
export { verifyAccessToken, type AccessTokenPayload } from "./jwt";
export {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
} from "./constants";
