import "server-only";

import { appRouter, type Context } from "@silonya/api";

/**
 * Server-side tRPC caller for the storefront (SEO_ARCHITECTURE.md §2 —
 * homepage/PLP/PDP are server-rendered, never client-fetched, so there's no
 * client-side tRPC/react-query setup here unlike apps/admin). Most public
 * catalog browsing needs no session; account-aware pages pass a context from
 * lib/customer-context.ts's getCustomerContext() instead.
 */
export function createServerCaller(ctx: Context = { adminSession: null, customerSession: null }) {
  return appRouter.createCaller(ctx);
}
