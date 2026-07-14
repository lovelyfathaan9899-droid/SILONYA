import "server-only";

import { type Context, appRouter } from "@silonya/api";

/**
 * Server-side tRPC caller — invokes router procedures directly in-process
 * (no HTTP round-trip) for use from Server Actions and Server Components,
 * where we also need to read/write httpOnly cookies via next/headers
 * (not possible from the fetch route handler cleanly — see api/trpc route).
 */
export function createServerCaller(ctx: Context) {
  return appRouter.createCaller(ctx);
}
