import { appRouter, createContext } from "@silonya/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// Read-only/query surface for client components (API_SPECIFICATION.md §2).
// Cookie-mutating flows (login/logout) go through Server Actions instead
// (apps/admin/app/login/actions.ts) since the fetch adapter has no clean
// way to write Set-Cookie headers back through Next.js's App Router.
function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
  });
}

export { handler as GET, handler as POST };
