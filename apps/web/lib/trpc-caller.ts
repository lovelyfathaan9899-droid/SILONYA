import "server-only";

import { appRouter } from "@silonya/api";

/**
 * Server-side tRPC caller for the storefront (SEO_ARCHITECTURE.md §2 —
 * homepage/PLP/PDP are server-rendered, never client-fetched, so there's no
 * client-side tRPC/react-query setup here unlike apps/admin). Public
 * catalog browsing needs no session, so the context is always empty.
 */
export function createServerCaller() {
  return appRouter.createCaller({ adminSession: null });
}
