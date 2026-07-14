# SILONYA — Search & Filtering Architecture

Defines how product discovery (search, faceted filtering, sorting) is implemented, per the **Meilisearch** decision in [TECH_STACK.md](./TECH_STACK.md).

> **Implementation status:** Meilisearch infrastructure isn't stood up yet. `catalog.search`/`catalog.list({ search })` (`packages/api/src/routers/catalog.ts`) currently run a Postgres `ILIKE` query as a deliberate, documented placeholder against the exact same query/index contract described here (§7's provider-agnostic design) — swap the implementation behind that contract when Meilisearch lands, not the calling code in `apps/web`.

---

## 1. Why a Dedicated Search Engine

Postgres `LIKE`/`ILIKE` queries do not scale to typo-tolerant, faceted, sub-100ms product search as the catalog grows, and would put read load directly on the transactional database that also handles checkout. Meilisearch is a separate, purpose-built read path: **Postgres remains the source of truth; Meilisearch is a derived, eventually-consistent index optimized for query speed.**

---

## 2. Index Architecture

**Index: `products`** — one document per `ProductVariant` (not per `Product`), since filtering (size, color, price) and availability are variant-level concerns (PRODUCT_SYSTEM.md §1). Documents are grouped back to their parent product at query time in the frontend for display.

Representative document shape (schema, not code):

| Field                       | Type           | Role                                                  |
| --------------------------- | -------------- | ----------------------------------------------------- |
| `id`                        | string         | variant ID                                            |
| `productId`, `slug`         | string         | link back to Product                                  |
| `name`, `description`       | string         | searchable                                            |
| `category`, `collections[]` | string / array | filterable                                            |
| `color`, `size`             | string         | filterable (option values)                            |
| `price`                     | number         | filterable, sortable                                  |
| `available`                 | boolean        | filterable (in stock only toggle)                     |
| `imageUrl`                  | string         | display                                               |
| `publishedAt`               | timestamp      | sortable ("Newest"), filterable (exclude unpublished) |

**Searchable attributes** (ranked): `name` > `description` > `category`/`collection` names.
**Filterable attributes:** `category`, `collections`, `color`, `size`, `price`, `available`.
**Sortable attributes:** `price`, `publishedAt`, plus a curated `position` field for "Recommended" (PRODUCT_SYSTEM.md §7).

---

## 3. Index Synchronization

```
Admin publishes/updates/archives a product (ADMIN_PANEL.md §4)
        │
        ▼
Postgres transaction commits (source of truth updated)
        │
        ▼
Domain event enqueued to BullMQ ("product.updated", productId)
        │
        ▼
Worker re-fetches the product + variants from Postgres, upserts corresponding
Meilisearch documents (or deletes them if archived/out of stock policy applies)
```

- **Asynchronous, not synchronous** — publishing a product returns immediately to the admin; index sync happens within seconds via the queue, not blocking the write path.
- **Inventory changes** (stock crossing zero) also trigger a lightweight `available` field update via the same event pattern, so out-of-stock filtering stays accurate without a full re-index.
- **Full reindex job** (nightly, or on-demand from the admin) exists as a reconciliation safety net in case an event is ever missed — the index is a cache and must always be rebuildable from Postgres alone.

---

## 4. Query Flow

```
apps/web (PLP)  ──catalog.search({q, filters, sort, cursor})──►  packages/api
                                                                        │
                                                                        ▼
                                                          Meilisearch query
                                                    (search + filter + sort + facet counts)
                                                                        │
                                                                        ▼
                                              Hydrate minimal display data directly from
                                              the Meilisearch response (no N+1 back to Postgres)
                                                                        │
                                                                        ▼
                                                        Paginated results + facet counts returned
```

Facet counts (e.g., "Black (12), Camel (8)") are computed by Meilisearch's faceting engine in the same query — critical for the filter UI to show accurate counts without separate queries per facet.

---

## 5. URL & State Rules

Per [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §4 principle #1 — filters/sort/search state lives in the URL query string (`?category=coats&color=black&sort=price-asc`), never only in client-side React state:

- Enables back-button correctness and shareable/bookmarkable filtered views.
- Server component reads the URL on initial render for SSR'd first-paint results (good for SEO on category pages), client-side navigation updates results without full reload thereafter.

---

## 6. Relevance & Ranking

- Default rank order in Meilisearch: typo tolerance → word proximity → attribute ranking (name > description) → exactness, then the custom `position` (merchandising-curated "Recommended" order) as a tiebreaker/override for collection pages.
- Typo tolerance is enabled by default (Meilisearch's core strength) — critical for a fashion catalog where customers may misspell brand-specific product names.
- Synonyms (e.g., "jumper" ↔ "sweater" for global English variants) configured in Meilisearch's synonym dictionary — maintained as a merchandising-editable list in Phase 3, hardcoded config at MVP.

---

## 7. Performance & Scale

- Meilisearch self-hosted initially (small, fast, cheap at SILONYA's launch catalog size); migration path to Meilisearch Cloud or Algolia is a config/infra change only if query volume or catalog size (tens of thousands of SKUs+) outgrows self-hosted capacity — not a re-architecture, since the query/index contract (§2, §4) is provider-agnostic in the `packages/api` abstraction layer.
- Search query latency target: < 50ms p95 at the Meilisearch layer (well within its typical performance envelope for catalogs under ~1M documents).

---

## 8. Zero-Results & Empty States

- Zero-result searches are logged (search term + timestamp, no PII) to identify catalog gaps or synonym opportunities — reviewed periodically by merchandising, not real-time automated.
- Zero-result state surfaces popular categories/collections as a recovery path rather than a dead end, per the "frictionless discovery" UX principle (DESIGN_SYSTEM.md §4).

---

## 9. Future Expansion

- **Personalized ranking** (Phase 5) — boosting results based on PostHog behavioral signals (browsing history, past purchases), layered on top of the base relevance algorithm without changing the index structure.
- **Visual/AI search** ("shop this look" from an image) — a plausible premium-fashion differentiator for a later phase; would integrate as an additional query path into the same `products` index via embedding-based similarity, evaluated once core search/filtering is proven at scale.
- **Autocomplete/instant search** — a lightweight, debounced query against the same index as the customer types, planned for Phase 3 alongside the full search experience.
