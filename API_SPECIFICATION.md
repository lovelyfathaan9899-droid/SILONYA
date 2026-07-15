# SILONYA — API Specification

Defines the API architecture connecting `apps/web` and `apps/admin` to the service layer in `packages/api`. This document specifies contracts and conventions, not implementation. See [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) for the underlying data model.

---

## 1. API Architecture

Two API surfaces, per [TECH_STACK.md](./TECH_STACK.md):

| Surface          | Technology                    | Consumers                                                                   | Why                                                                    |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Internal API** | tRPC                          | `apps/web`, `apps/admin` (first-party only)                                 | End-to-end type safety, no schema drift, no over-fetching              |
| **External API** | REST (Next.js Route Handlers) | Stripe/carrier webhooks, future third-party integrations, future public API | External systems need a stable, documented, language-agnostic contract |

**Rule:** the internal tRPC API is never exposed to untrusted external clients. Anything a browser extension, third-party app, or partner integration needs goes through the versioned REST surface under `/api/v1/*`.

---

## 2. tRPC Router Structure

Routers are organized by domain and live in `packages/api/routers/`, composed into a single `appRouter`:

```
appRouter
├── adminAuth   (login, logout, session)                                          [implemented]
├── adminCatalog (create/update/archive product, options, variants, inventory, media) [implemented]
├── catalog     (list, getBySlug, getCollectionBySlug, getCategoryBySlug, search)  [implemented — public, customer-facing]
├── checkout    (createIntent, previewDiscount, getOrderByToken, lookupOrder)     [implemented — public, guest checkout; no `cart` router — the pre-checkout cart is client-side, see DATABASE_ARCHITECTURE.md §3.4's implementation note]
├── account     (getProfile, updateProfile, listOrders, listAddresses, wishlist)
├── admin.orders     (list, getById, updateStatus, issueRefund)
├── admin.discounts  (CRUD)
└── admin.users      (list customers, manage admin roles/permissions)
```

Routers are composed flat on `appRouter` (`adminAuth`, `adminCatalog`, `catalog`, ...) rather than nested namespaces — tRPC v11 doesn't require nesting for this, and a flat tree keeps `caller.catalog.list(...)` call sites shorter. The `admin.*` names above for not-yet-built routers are illustrative; when built they'll likely follow the same flat `adminOrders`/`adminDiscounts`/`adminUsers` convention.

- Every procedure is either `publicProcedure`, `protectedProcedure` (requires authenticated user), or `adminProcedure` (requires authenticated admin + permission check) — enforced by tRPC middleware, never by convention alone.
- Input/output for every procedure is a Zod schema, shared between client and server — a request that doesn't validate never reaches business logic.
- Mutations that touch money or inventory (`checkout.createIntent`, `admin.orders.updateStatus`) are wrapped in a single DB transaction (DATABASE_ARCHITECTURE.md §5).

### Representative procedure signatures (contract, not code)

| Procedure                     | Type     | Input                                                                      | Output                                                | Auth                                        |
| ----------------------------- | -------- | -------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| `catalog.getBySlug`           | query    | `{ slug: string }`                                                         | `Product & { options, variants, media, related }`     | public                                      |
| `catalog.list`                | query    | `{ collectionSlug?, categorySlug?, search?, sort?, cursor?, limit? }`      | paginated `Product[]` card summaries                  | public                                      |
| `checkout.createIntent`       | mutation | `{ items[], guestEmail, shippingAddress, billingAddress?, discountCode? }` | `{ checkoutUrl, orderId }` (Stripe Checkout redirect) | public                                      |
| `checkout.getOrderByToken`    | query    | `{ token }` (signed order-access token)                                    | `Order & { items, addresses, payment }`               | public (token-scoped, not a login session)  |
| `checkout.lookupOrder`        | mutation | `{ orderNumber, email }`                                                   | `{ token }`                                           | public (ownership verified by number+email) |
| `account.listOrders`          | query    | `{ cursor?, limit? }`                                                      | paginated `Order[]`                                   | protected                                   |
| `admin.orders.updateStatus`   | mutation | `{ orderId, status, note? }`                                               | `Order`                                               | admin (`orders:write`)                      |
| `admin.catalog.createProduct` | mutation | full product payload                                                       | `Product`                                             | admin (`catalog:write`)                     |

Pagination is **cursor-based** everywhere (not offset), for consistent performance as tables grow.

---

## 3. REST API (External Surface)

Base path: `/api/v1/`. Versioned from day one — a `v2` can be introduced without breaking existing integrations.

| Endpoint                                           | Method | Purpose                                   | Auth                            |
| -------------------------------------------------- | ------ | ----------------------------------------- | ------------------------------- |
| `/api/v1/webhooks/stripe` [implemented]            | POST   | Payment/refund/dispute events from Stripe | Stripe signature verification   |
| `/api/v1/webhooks/shipping/{carrier}`              | POST   | Shipment tracking updates (Phase 4)       | Provider signature verification |
| `/api/v1/sitemap.xml`                              | GET    | Dynamic sitemap generation                | public                          |
| `/api/v1/health`                                   | GET    | Liveness/readiness probe                  | public, no sensitive data       |
| `/api/v1/products` _(future public API, Phase 5+)_ | GET    | Read-only catalog access for partners     | API key                         |

**Webhook handling rule:** every inbound webhook is (1) signature-verified before any processing, (2) idempotency-checked against a `ProcessedWebhookEvent` table keyed by provider event ID, (3) queued to BullMQ for actual processing rather than handled synchronously in the request — the route handler's only job is verify-and-enqueue. Full detail in [PAYMENT_ARCHITECTURE.md](./PAYMENT_ARCHITECTURE.md) §4.

> **Implementation status (Phase 6):** step 3 (BullMQ) isn't wired up yet — the Stripe webhook handler verifies, checks idempotency, then processes the event synchronously in the same request (still fast: one DB transaction plus a best-effort email). See PAYMENT_ARCHITECTURE.md §3's implementation note.

---

## 4. Error Handling Contract

All API errors — tRPC and REST — follow a single shape so the frontend has one error-handling path:

```
{
  code: string        // machine-readable, e.g. "INVENTORY_INSUFFICIENT"
  message: string      // human-readable, safe to display
  fieldErrors?: Record<string, string>   // for form validation
}
```

- tRPC errors use standard `TRPCError` codes (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`) mapped to HTTP status on the REST edges.
- Internal error detail (stack traces, DB errors) is **never** sent to the client — logged to Sentry server-side, client receives the safe `code`/`message` only.
- Business-rule failures (out of stock, invalid discount code, payment declined) are modeled as expected outcomes with specific `code`s, not generic 500s — the frontend can render a precise message.

---

## 5. Rate Limiting & Abuse Prevention

Enforced at the edge via Redis-backed counters (Upstash rate limit), per [PROJECT_RULES.md](./PROJECT_RULES.md) §8:

| Surface                 | Limit                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| `auth.login`            | 5 attempts / 15 min / IP+email combination                                  |
| `auth.register`         | 10 / hour / IP                                                              |
| `checkout.createIntent` | 20 / hour / session                                                         |
| Public REST endpoints   | 100 req / min / IP                                                          |
| Admin procedures        | 300 req / min / admin session (generous — trusted users, but still bounded) |

Exceeding a limit returns `429` with a `Retry-After` header, never a silent failure.

---

## 6. Caching Strategy

| Data                      | Cache                                                               | TTL / Invalidation                                                                |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Product listings/PDP data | Next.js ISR (`revalidate`) + CDN edge cache                         | Revalidated on admin publish/update via on-demand revalidation (`revalidatePath`) |
| Cart                      | Redis                                                               | Session-lived, no cold-cache concern                                              |
| Search results            | Meilisearch (own index, kept in sync via webhook on product change) | See [SEARCH_AND_FILTERS.md](./SEARCH_AND_FILTERS.md)                              |
| Session/auth checks       | Redis                                                               | Matches session TTL, see [AUTHENTICATION.md](./AUTHENTICATION.md)                 |

**Rule:** anything affecting price or stock is never served from a cache with a TTL longer than a few seconds _at checkout time_ — catalog browsing can be cached aggressively, but `checkout.createIntent` always re-reads current price/stock from Postgres directly, never from ISR-cached data.

---

## 7. API Versioning & Deprecation

- Internal tRPC API has no external versioning contract — client and server deploy together (same monorepo, same release).
- REST `/api/v1/` is versioned by URL path. Breaking changes require a new version; old versions are supported for a documented deprecation window once a public partner API exists (Phase 5+).

---

## 8. Documentation & Discoverability

- tRPC provides compile-time type inference — no separate API docs needed for internal consumption; `packages/api` is the documentation.
- REST endpoints are documented via OpenAPI spec generated alongside the route handlers once the public API surface (Phase 5+) is built — not required for MVP's webhook-only REST surface.
