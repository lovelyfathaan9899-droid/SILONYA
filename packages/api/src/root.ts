import { accountRouter } from "./routers/account";
import { adminAnalyticsRouter } from "./routers/admin-analytics";
import { adminAuthRouter } from "./routers/admin-auth";
import { adminCatalogRouter } from "./routers/admin-catalog";
import { adminCmsRouter } from "./routers/admin-cms";
import { adminCustomersRouter } from "./routers/admin-customers";
import { adminDiscountsRouter } from "./routers/admin-discounts";
import { adminGiftCardsRouter } from "./routers/admin-gift-cards";
import { adminOrdersRouter } from "./routers/admin-orders";
import { adminReviewsRouter } from "./routers/admin-reviews";
import { adminSearchRouter } from "./routers/admin-search";
import { catalogRouter } from "./routers/catalog";
import { checkoutRouter } from "./routers/checkout";
import { cmsRouter } from "./routers/cms";
import { customerAuthRouter } from "./routers/customer-auth";
import { giftCardsRouter } from "./routers/gift-cards";
import { reviewsRouter } from "./routers/reviews";
import { searchRouter } from "./routers/search";
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
  adminSearch: adminSearchRouter,
  adminCms: adminCmsRouter,
  adminAnalytics: adminAnalyticsRouter,
  catalog: catalogRouter,
  checkout: checkoutRouter,
  customerAuth: customerAuthRouter,
  account: accountRouter,
  reviews: reviewsRouter,
  giftCards: giftCardsRouter,
  search: searchRouter,
  cms: cmsRouter,
});

export type AppRouter = typeof appRouter;
