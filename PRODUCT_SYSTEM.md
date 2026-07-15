# SILONYA — Product Catalog System

Describes how products, variants, inventory, and merchandising work end to end — the domain model underlying [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) §3.2–3.3, exposed via [API_SPECIFICATION.md](./API_SPECIFICATION.md).

---

## 1. Product Model

A **Product** is a design (e.g., "Wool Overcoat"); a **ProductVariant** is the sellable unit (e.g., "Wool Overcoat, Black, size M"). This split is fundamental: pricing, inventory, SKUs, and cart/order line items always operate at the **variant** level, while marketing content, SEO, and browsing operate at the **product** level.

```
Product "Wool Overcoat"
├── Option: Color → [Black, Camel]
├── Option: Size  → [XS, S, M, L, XL]
└── Variants (Color × Size = up to 10)
     ├── Variant: Black / M   (SKU: WOC-BLK-M,  stock: 12)
     ├── Variant: Camel / S   (SKU: WOC-CML-S,  stock: 4)
     └── ...
```

Not every combination need exist (e.g., a color may not ship in every size) — variants are explicitly created, not auto-generated from the full Cartesian product.

---

## 2. Product Lifecycle

```
draft ──(complete required fields + at least 1 variant + 1 image)──► active
active ──(manually)──► archived
draft/active ──(soft delete)──► deletedAt set, removed from all customer surfaces
```

**Required to move `draft → active`:** name, slug, description, at least one variant with a price and SKU, at least one product image with alt text (DESIGN_SYSTEM.md §6), at least one category or collection assignment. Enforced in the admin API (`admin.catalog.publishProduct`), not just as a UI suggestion — an incomplete product cannot go live.

**Archived** products remain in the database (for historical order references — DATABASE_ARCHITECTURE.md §3.5 snapshots order data anyway, but archiving keeps the catalog clean) but are excluded from listings, search, and sitemaps.

---

## 3. Pricing

- Base price lives on `Product.basePrice`; a `ProductVariant.price` override exists for variants priced differently (rare — e.g., an extended size surcharge).
- All prices stored as integer minor units in the product's `currency` (DATABASE_ARCHITECTURE.md §3.2).
- `compareAtPrice` on a variant enables strike-through "was/now" display for markdowns — set and cleared explicitly by merchandising, never auto-computed from history, to avoid misleading discount claims.
- **Multi-currency (Phase 4):** a `PriceList(variantId, currency, price)` table is added; until then, a single currency (USD) is canonical and all display is in that currency.
- Price changes take effect immediately for new carts; a cart item's `unitPriceSnapshot` (DATABASE_ARCHITECTURE.md §3.4) is revalidated against current price at checkout — if it changed, the customer is shown the updated price before payment, never silently charged a different amount than what they saw.

---

## 4. Inventory Management

### 4.1 Availability Calculation

`available = quantityOnHand - quantityReserved`, computed server-side on every add-to-cart and checkout attempt — never cached longer than the immediate request.

### 4.2 Reservation Flow

```
Add to cart          → no reservation yet (cart is not a commitment)
Begin checkout        → quantityReserved += qty  (soft hold, time-boxed to ~15 min)
Payment succeeds       → quantityOnHand -= qty, quantityReserved -= qty (finalize)
Payment fails/abandons  → quantityReserved -= qty (release, via expiry job)
```

A BullMQ scheduled job sweeps expired reservations every minute, releasing stock held by abandoned checkouts back into availability — preventing "phantom sold out" states.

> **Implementation status (Phase 6):** this sweep job doesn't exist yet (no Redis/BullMQ provisioned) — a checkout abandoned before payment completes (no webhook ever arrives) leaves its reservation in place indefinitely instead of releasing after ~15 minutes. Deterministic release still works correctly on `payment_intent.payment_failed`/`checkout.session.async_payment_failed` and when Stripe Checkout Session creation itself fails (`packages/api/src/routers/checkout/index.ts`'s catch block). Add the sweep job once queue infrastructure exists.

### 4.3 Oversell Prevention

Conditional update pattern (DATABASE_ARCHITECTURE.md §5): `UPDATE inventory SET quantityReserved = quantityReserved + :qty WHERE variantId = :id AND quantityOnHand - quantityReserved >= :qty`. Zero rows affected = insufficient stock, surfaced to the user immediately with a specific `INVENTORY_INSUFFICIENT` error code (API_SPECIFICATION.md §4), not a generic failure.

### 4.4 Low-Stock & Backorder

- Admin dashboard surfaces low-stock alerts (configurable threshold per variant) — see [ADMIN_PANEL.md](./ADMIN_PANEL.md) §4.
- Backorder/pre-order support is a Phase 3+ consideration, not required for MVP; the schema's `quantityOnHand` allowing negative values is explicitly _not_ permitted (check constraint) until backorder logic is deliberately designed.

---

## 5. Categories & Collections

Two distinct, complementary organization systems:

|            | Category                                        | Collection                                                      |
| ---------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Structure  | Hierarchical tree (Women > Outerwear > Coats)   | Flat, curated list                                              |
| Purpose    | Primary navigation, taxonomy, faceted filtering | Editorial/marketing groupings ("Autumn 2026," "The Essentials") |
| Assignment | A product typically has exactly one category    | A product can belong to many collections                        |
| Managed by | Fairly static, set up early                     | Frequently created/updated by merchandising                     |

Both are many-to-many at the schema level for flexibility, but category assignment is treated as effectively single-select in the admin UX to keep navigation coherent.

---

## 6. Product Detail Page (PDP) Data Contract

`catalog.getProductBySlug` (API_SPECIFICATION.md §2) returns everything the PDP needs in one call:

- Product core fields (name, description, SEO fields)
- All variants with price, compareAtPrice, computed availability, and option values
- All media (ordered, with alt text), including variant-specific imagery
- Related products (same category, curated or algorithmic — Phase 3)
- Structured data payload for SEO (SEO_ARCHITECTURE.md §3)

This is rendered via SSG with ISR (API_SPECIFICATION.md §6) — revalidated on-demand the moment an admin publishes a change, so pages are fast by default but never stale after an edit.

---

## 7. Merchandising Rules

- **Sort orders** on listing pages: "Recommended" (curated/manual position, default), Price (asc/desc), Newest. "Recommended" order is set per-collection by merchandising in the admin, not algorithmic at launch.
- **Faceted filtering** (category, size, color, price range) is powered by Meilisearch, detailed in [SEARCH_AND_FILTERS.md](./SEARCH_AND_FILTERS.md) — the Postgres catalog is the system of record, but browsing/filtering reads from the search index, not live SQL queries, for performance at scale.
- **Out-of-stock handling:** an out-of-stock variant remains visible (never hidden — hiding it looks like a broken link and destroys SEO equity on that PDP) but is unselectable, clearly labeled, with an optional "notify me" capture (Phase 3).

---

## 8. Reviews (Phase 3)

- Reviews are tied to a verified `Order` (DATABASE_ARCHITECTURE.md §3.7) — only customers who purchased the specific product can review it, preserving trust.
- Moderation queue (`pending → published/rejected`) in the admin before a review is public — automated profanity/spam filtering plus manual spot-check, not full manual review of every submission at scale.
- Aggregate rating is a computed/cached value on `Product` (denormalized deliberately, per DATABASE_ARCHITECTURE.md §1 principle #2), recalculated on review publish/removal.

---

## 9. Future Expansion

- **Product bundles/sets** (e.g., "shop the look") — modeled as a `Bundle` entity referencing multiple products, additive to the schema, not a rework.
- **Personalized/AI-driven merchandising** (Phase 5) — replaces manual "Recommended" ordering with a ranking service consuming PostHog behavioral data; the catalog API contract (§6) doesn't need to change, only the ordering logic behind it.
- **Multi-brand catalog** — `Product.brandId` already reserved (DATABASE_ARCHITECTURE.md §7).
