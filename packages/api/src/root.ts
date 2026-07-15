import { accountRouter } from "./routers/account";
import { adminAuthRouter } from "./routers/admin-auth";
import { adminCatalogRouter } from "./routers/admin-catalog";
import { adminCustomersRouter } from "./routers/admin-customers";
import { adminDiscountsRouter } from "./routers/admin-discounts";
import { adminGiftCardsRouter } from "./routers/admin-gift-cards";
import { adminOrdersRouter } from "./routers/admin-orders";
import { adminReviewsRouter } from "./routers/admin-reviews";
import { catalogRouter } from "./routers/catalog";
import { checkoutRouter } from "./routers/checkout";
import { customerAuthRouter } from "./routers/customer-auth";
import { giftCardsRouter } from "./routers/gift-cards";
import { reviewsRouter } from "./routers/reviews";
import { router } from "./trpc";

// API_SPECIFICATION.md §2 — routers are organized by domain and composed
// here.
export const appRouter = router({
  adminAuth: adminAuthRouter,
  adminCatalog: adminCatalogRouter,
  adminOrders: router(adminOrdersRouter),
  adminCustomers: adminCustomersRouter,
  adminReviews: adminReviewsRouter,
  adminDiscounts: adminDiscountsRouter,
  adminGiftCards: adminGiftCardsRouter,
  catalog: catalogRouter,
  checkout: checkoutRouter,
  customerAuth: customerAuthRouter,
  account: accountRouter,
  reviews: reviewsRouter,
  giftCards: giftCardsRouter,
});

export type AppRouter = typeof appRouter;
