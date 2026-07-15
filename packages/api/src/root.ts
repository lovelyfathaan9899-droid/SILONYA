import { adminAuthRouter } from "./routers/admin-auth";
import { adminCatalogRouter } from "./routers/admin-catalog";
import { adminOrdersRouter } from "./routers/admin-orders";
import { catalogRouter } from "./routers/catalog";
import { checkoutRouter } from "./routers/checkout";
import { router } from "./trpc";

// API_SPECIFICATION.md §2 — routers are organized by domain and composed
// here. `account`/`auth` (customer) are added when customer accounts are
// built — guest checkout only for now (ORDER_MANAGEMENT.md §4).
export const appRouter = router({
  adminAuth: adminAuthRouter,
  adminCatalog: adminCatalogRouter,
  adminOrders: router(adminOrdersRouter),
  catalog: catalogRouter,
  checkout: checkoutRouter,
});

export type AppRouter = typeof appRouter;
