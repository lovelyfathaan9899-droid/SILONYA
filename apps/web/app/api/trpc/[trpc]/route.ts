import { appRouter, createContext } from "@silonya/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// Client-side surface for storefront interactivity that needs a live
// mutation (checkout, discount preview, order lookup) — everything
// server-renderable still goes through lib/trpc-caller.ts's direct
// in-process caller (SEO_ARCHITECTURE.md §2), this route exists only for
// what a client component must call itself.
function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
  });
}

export { handler as GET, handler as POST };
