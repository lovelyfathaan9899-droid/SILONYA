import { adminAuthRouter } from "./routers/admin-auth";
import { adminCatalogRouter } from "./routers/admin-catalog";
import { catalogRouter } from "./routers/catalog";
import { router } from "./trpc";

// API_SPECIFICATION.md §2 — routers are organized by domain and composed
// here. `cart`/`checkout`/`account`/`auth` (customer) are added when
// checkout/customer-accounts are built (explicitly out of scope for
// ROADMAP.md's storefront-UI phase — see PHASE 5 notes in catalog.ts).
export const appRouter = router({
  adminAuth: adminAuthRouter,
  adminCatalog: adminCatalogRouter,
  catalog: catalogRouter,
});

export type AppRouter = typeof appRouter;
