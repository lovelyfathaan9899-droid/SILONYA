import type { AppRouter } from "@silonya/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

// Vanilla (non-React-Query) client for the handful of client-side calls the
// storefront needs (checkout, discount preview, order lookup) — apps/web
// deliberately has no react-query provider (Phase 5 architecture note: every
// server-renderable page uses lib/trpc-caller.ts's in-process caller
// instead), so this is a plain typed fetch wrapper, not a hooks API.
export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});
