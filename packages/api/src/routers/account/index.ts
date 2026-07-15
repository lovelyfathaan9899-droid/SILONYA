import { router } from "../../trpc";
import { addressesRouter } from "./addresses";
import { ordersRouter } from "./orders";
import { profileRouter } from "./profile";
import { recentlyViewedRouter } from "./recently-viewed";
import { wishlistRouter } from "./wishlist";

// API_SPECIFICATION.md §2 — account.* (CUSTOMER ACCOUNT SYSTEM), split into
// per-domain sub-routers matching admin-catalog's convention.
export const accountRouter = router({
  profile: profileRouter,
  addresses: addressesRouter,
  orders: ordersRouter,
  wishlist: wishlistRouter,
  recentlyViewed: recentlyViewedRouter,
});
