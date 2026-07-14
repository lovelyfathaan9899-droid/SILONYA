import { router } from "../../trpc";
import { inventoryRouter } from "./inventory";
import { mediaRouter } from "./media";
import { optionsRouter } from "./options";
import { productsRouter } from "./products";
import { taxonomyRouter } from "./taxonomy";
import { variantsRouter } from "./variants";

// API_SPECIFICATION.md §2 — admin.catalog ("create/update/archive product,
// manage inventory"), split into per-domain sub-routers so each file stays
// under PROJECT_RULES.md §4's ~300-line guideline.
export const adminCatalogRouter = router({
  products: router(productsRouter),
  options: router(optionsRouter),
  variants: router(variantsRouter),
  inventory: router(inventoryRouter),
  taxonomy: router(taxonomyRouter),
  media: router(mediaRouter),
});
