# SILONYA — Database Architecture

Authoritative reference for SILONYA's data model. Database: **PostgreSQL**, accessed exclusively through **Prisma** (see [TECH_STACK.md](./TECH_STACK.md)). This document describes entities, relationships, constraints, and data-integrity strategy — not implementation code. The actual Prisma schema is generated from this design during Phase 1 ([ROADMAP.md](./ROADMAP.md)).

---

## 1. Design Principles

1. **The database is the source of truth for money, inventory, and identity.** No financial or stock value is ever trusted from the client — it is read from and written to Postgres under transactional guarantees.
2. **Normalize by default, denormalize deliberately.** We start 3NF-normalized; any denormalization (e.g., caching a product's price on an order line item) is intentional and documented, never accidental drift.
3. **Immutability where correctness demands it.** Orders, payments, and their line items are never mutated after creation except through explicit, audited state transitions — history is preserved via status/event tables, not overwrites.
4. **Every table has an audit trail.** `createdAt`, `updatedAt` on every table; sensitive domains (orders, payments, admin actions) additionally get append-only history tables.
5. **Soft delete for customer-facing content, hard delete for ephemeral data.** Products, users, and orders are never hard-deleted (use `deletedAt`); cart items and sessions may be hard-deleted on expiry.
6. **UUIDs for all primary keys.** Prevents enumeration attacks on public-facing IDs (e.g., order lookup) and simplifies future multi-region/sharded growth.

---

## 2. Entity-Relationship Overview

```
User ──1:N── Address
User ──1:1── Cart ──1:N── CartItem ──N:1── ProductVariant
User ──1:N── Order
User ──1:N── Wishlist ──1:N── WishlistItem ──N:1── ProductVariant
User ──1:N── Review ──N:1── Product

Product ──1:N── ProductVariant
Product ──N:N── Collection (via ProductCollection)
Product ──N:N── Category (via ProductCategory)
Product ──1:N── ProductMedia
ProductVariant ──1:N── ProductOptionValue (size/color combination)
ProductVariant ──1:N── Inventory ──N:1── Warehouse

Order ──1:N── OrderItem ──N:1── ProductVariant (price/name snapshotted)
Order ──1:N── OrderStatusEvent
Order ──1:1── Payment ──1:N── Refund
Order ──N:1── Address (shipping) + Address (billing)
Order ──0:1── Discount (applied)

Discount ──1:N── DiscountRedemption ──N:1── Order

AdminUser ──N:1── Role ──N:N── Permission (via RolePermission)
AdminUser ──1:N── AuditLogEntry
AdminUser ──1:N── AdminSession
```

---

## 3. Core Domains

### 3.1 Identity & Access

**User**

| Field                             | Type        | Constraints                   |
| --------------------------------- | ----------- | ----------------------------- |
| id                                | UUID        | PK                            |
| email                             | citext      | unique, not null              |
| passwordHash                      | text        | nullable (null if OAuth-only) |
| firstName / lastName              | text        | nullable                      |
| phone                             | text        | nullable                      |
| emailVerifiedAt                   | timestamptz | nullable                      |
| marketingOptIn                    | boolean     | default false                 |
| defaultAddressId                  | UUID        | FK → Address, nullable        |
| createdAt / updatedAt / deletedAt | timestamptz |                               |

**AuthIdentity** (supports multiple OAuth providers per user)

| Field             | Type                                 | Constraints                             |
| ----------------- | ------------------------------------ | --------------------------------------- |
| id                | UUID                                 | PK                                      |
| userId            | UUID                                 | FK → User, not null                     |
| provider          | enum(`credentials`,`google`,`apple`) | not null                                |
| providerAccountId | text                                 | not null                                |
| —                 |                                      | unique(`provider`, `providerAccountId`) |

**Session**

| Field                 | Type        | Constraints           |
| --------------------- | ----------- | --------------------- |
| id                    | UUID        | PK                    |
| userId                | UUID        | FK → User, not null   |
| refreshTokenHash      | text        | not null, indexed     |
| userAgent / ipAddress | text        | for anomaly detection |
| expiresAt             | timestamptz | not null              |
| revokedAt             | timestamptz | nullable              |

**Address**

| Field                                                    | Type    | Constraints                                                            |
| -------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| id                                                       | UUID    | PK                                                                     |
| userId                                                   | UUID    | FK → User, nullable (guest checkout addresses reference Order instead) |
| line1 / line2 / city / region / postalCode / countryCode | text    | countryCode = ISO 3166-1 alpha-2                                       |
| phone                                                    | text    | nullable                                                               |
| isDefault                                                | boolean | default false                                                          |

**AdminSession** — mirrors `Session` but scoped to `AdminUser`, kept as a distinct table rather than a shared polymorphic session table so a customer session can never be structurally confused with an admin session (AUTHENTICATION.md §1). Same fields as `Session` (refreshTokenHash, userAgent, ipAddress, expiresAt, revokedAt), FK to `AdminUser` instead of `User`. The shorter admin session TTL (AUTHENTICATION.md §3) is enforced in `packages/auth`, not at the schema level.

Full RBAC model (AdminUser, Role, Permission) is defined in [AUTHENTICATION.md](./AUTHENTICATION.md) §4, since it's specific to the admin authorization domain. Full auth flow detail (tokens, sessions, OAuth) is in [AUTHENTICATION.md](./AUTHENTICATION.md).

---

### 3.2 Catalog

**Product**

| Field                             | Type                              | Constraints                                                                  |
| --------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| id                                | UUID                              | PK                                                                           |
| slug                              | text                              | unique, not null, indexed                                                    |
| name                              | text                              | not null                                                                     |
| description                       | text                              | rich text/markdown                                                           |
| status                            | enum(`draft`,`active`,`archived`) | default `draft`                                                              |
| basePrice                         | integer (minor units)             | not null — **all money stored as integer minor units (cents), never floats** |
| currency                          | char(3)                           | ISO 4217, default `USD`                                                      |
| brandId                           | UUID                              | reserved for future multi-brand, nullable at launch                          |
| seoTitle / seoDescription         | text                              | nullable, see [SEO_ARCHITECTURE.md](./SEO_ARCHITECTURE.md)                   |
| publishedAt                       | timestamptz                       | nullable                                                                     |
| createdAt / updatedAt / deletedAt | timestamptz                       |                                                                              |

**ProductOption** (e.g., "Size", "Color") / **ProductOptionValue** (e.g., "M", "Black")

- `ProductOption`: id, productId (FK), name, position
- `ProductOptionValue`: id, productOptionId (FK), value, position

**ProductVariant** — the actual sellable unit (a specific size/color combination)

| Field          | Type    | Constraints                                                       |
| -------------- | ------- | ----------------------------------------------------------------- |
| id             | UUID    | PK                                                                |
| productId      | UUID    | FK → Product, not null                                            |
| sku            | text    | unique, not null                                                  |
| price          | integer | overrides `Product.basePrice` if set; nullable                    |
| compareAtPrice | integer | nullable, for strike-through pricing                              |
| weightGrams    | integer | for shipping calculation                                          |
| barcode        | text    | nullable                                                          |
| optionValues   |         | join table `VariantOptionValue` (variantId, productOptionValueId) |

**ProductMedia**

| Field     | Type    | Constraints                                              |
| --------- | ------- | -------------------------------------------------------- |
| id        | UUID    | PK                                                       |
| productId | UUID    | FK → Product                                             |
| variantId | UUID    | FK → ProductVariant, nullable (variant-specific imagery) |
| url       | text    | Cloudinary asset reference                               |
| altText   | text    | required for accessibility (DESIGN_SYSTEM.md §6)         |
| position  | integer | display order                                            |

**Category** (hierarchical taxonomy, e.g., Women > Outerwear > Coats) — adjacency list via `parentId`, self-referencing FK.

**Collection** (curated/editorial groupings, e.g., "Autumn 2026") — flat, many-to-many with Product via `ProductCollection`.

Full catalog behavior (variant logic, pricing rules, publishing workflow) is detailed in [PRODUCT_SYSTEM.md](./PRODUCT_SYSTEM.md).

---

### 3.3 Inventory

**Warehouse**

| Field             | Type    |
| ----------------- | ------- |
| id                | UUID PK |
| name, countryCode | text    |
| isDefault         | boolean |

**Inventory**

| Field            | Type    | Constraints                                                 |
| ---------------- | ------- | ----------------------------------------------------------- |
| id               | UUID    | PK                                                          |
| variantId        | UUID    | FK → ProductVariant                                         |
| warehouseId      | UUID    | FK → Warehouse                                              |
| quantityOnHand   | integer | not null, default 0, **check constraint ≥ 0**               |
| quantityReserved | integer | not null, default 0 — reserved by open carts/pending orders |
| —                |         | unique(`variantId`, `warehouseId`)                          |

Available-to-sell = `quantityOnHand - quantityReserved`, always computed server-side. Reservation/release logic detailed in [ORDER_MANAGEMENT.md](./ORDER_MANAGEMENT.md) §3.

---

### 3.4 Cart

**Cart** — one active cart per user (or anonymous session token for guests); primary store is **Redis** for speed, with a Postgres row created at checkout-intent time for durability and analytics.

| Field        | Type                                    |
| ------------ | --------------------------------------- |
| id           | UUID PK                                 |
| userId       | UUID FK → User, nullable (guest)        |
| sessionToken | text, nullable — identifies guest carts |
| currency     | char(3)                                 |
| expiresAt    | timestamptz                             |

**CartItem**

| Field             | Type                                                    |
| ----------------- | ------------------------------------------------------- |
| id                | UUID PK                                                 |
| cartId            | UUID FK                                                 |
| variantId         | UUID FK → ProductVariant                                |
| quantity          | integer, check > 0                                      |
| unitPriceSnapshot | integer — price at time of add, revalidated at checkout |

---

### 3.5 Orders & Payments

**Order** — immutable once placed except via defined status transitions.

| Field                                                            | Type        | Constraints                                                          |
| ---------------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| id                                                               | UUID        | PK                                                                   |
| orderNumber                                                      | text        | unique, human-readable (e.g., `SIL-100234`), not null                |
| userId                                                           | UUID        | FK → User, nullable (guest orders store email directly)              |
| guestEmail                                                       | text        | nullable, required if `userId` is null                               |
| status                                                           | enum        | see state machine in [ORDER_MANAGEMENT.md](./ORDER_MANAGEMENT.md) §2 |
| subtotal / shippingTotal / taxTotal / discountTotal / grandTotal | integer     | minor units, **all server-computed, never client-supplied**          |
| currency                                                         | char(3)     |                                                                      |
| shippingAddressId / billingAddressId                             | UUID        | FK → Address                                                         |
| discountId                                                       | UUID        | FK → Discount, nullable                                              |
| placedAt                                                         | timestamptz |                                                                      |
| createdAt / updatedAt                                            | timestamptz |                                                                      |

**OrderItem** — line items snapshot product data at time of purchase (never joins live to `Product` for display/legal purposes; a product can change/be deleted after the order exists).

| Field                                                    | Type                                      |
| -------------------------------------------------------- | ----------------------------------------- |
| id                                                       | UUID PK                                   |
| orderId                                                  | UUID FK                                   |
| variantId                                                | UUID FK → ProductVariant (reference only) |
| productNameSnapshot / variantLabelSnapshot / skuSnapshot | text                                      |
| unitPrice                                                | integer                                   |
| quantity                                                 | integer                                   |
| lineTotal                                                | integer                                   |

**OrderStatusEvent** — append-only audit trail of every status transition (who/what triggered it, when).

**Payment**

| Field                 | Type                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| id                    | UUID PK                                                                                   |
| orderId               | UUID FK, unique                                                                           |
| stripePaymentIntentId | text, unique                                                                              |
| status                | enum(`requires_action`,`processing`,`succeeded`,`failed`,`refunded`,`partially_refunded`) |
| amount                | integer                                                                                   |
| currency              | char(3)                                                                                   |

**Refund**

| Field          | Type        |
| -------------- | ----------- |
| id             | UUID PK     |
| paymentId      | UUID FK     |
| stripeRefundId | text        |
| amount         | integer     |
| reason         | text        |
| createdAt      | timestamptz |

Full order lifecycle, reservation, and refund workflows: [ORDER_MANAGEMENT.md](./ORDER_MANAGEMENT.md). Full payment/Stripe integration detail: [PAYMENT_ARCHITECTURE.md](./PAYMENT_ARCHITECTURE.md).

---

### 3.6 Promotions

**Discount**

| Field                     | Type                                               |
| ------------------------- | -------------------------------------------------- |
| id                        | UUID PK                                            |
| code                      | text, unique, nullable (null = automatic discount) |
| type                      | enum(`percentage`,`fixedAmount`,`freeShipping`)    |
| value                     | integer                                            |
| startsAt / endsAt         | timestamptz                                        |
| usageLimit / perUserLimit | integer, nullable                                  |
| minimumSubtotal           | integer, nullable                                  |

**DiscountRedemption** — one row per use, enforces `perUserLimit`/`usageLimit` via count query inside the checkout transaction.

---

### 3.7 Reviews & Wishlist (Phase 3)

**Review**: id, productId (FK), userId (FK), orderId (FK, proves verified purchase), rating (1–5), title, body, status(`pending`,`published`,`rejected`), createdAt.

**Wishlist / WishlistItem**: standard 1:N, unique(`userId`,`variantId`) on the item table.

---

## 4. Indexing Strategy

| Table              | Index                                      | Reason                               |
| ------------------ | ------------------------------------------ | ------------------------------------ |
| Product            | `slug` (unique), `status`                  | routing, catalog filtering           |
| ProductVariant     | `sku` (unique), `productId`                | lookups, catalog joins               |
| Inventory          | `(variantId, warehouseId)` unique          | availability checks                  |
| Order              | `orderNumber` (unique), `userId`, `status` | account order history, admin queries |
| Session            | `refreshTokenHash` (unique)                | auth lookups                         |
| User               | `email` (unique, citext)                   | login                                |
| DiscountRedemption | `(discountId, userId)`                     | per-user limit enforcement           |

All foreign keys are indexed by default via Prisma's relation handling; the table above lists indexes _beyond_ FK columns.

---

## 5. Data Integrity & Transactions

- **Checkout is a single database transaction:** validate stock → reserve inventory → create Order + OrderItems → create Payment intent reference. If any step fails, the entire transaction rolls back — no partial orders.
- **Optimistic concurrency on Inventory:** updates use `WHERE quantityOnHand - quantityReserved >= :requestedQty` conditional updates to prevent overselling under concurrent checkouts, rather than row locking, to keep throughput high.
- **Money is always integers (minor units).** No `float`/`decimal` rounding ambiguity is allowed anywhere in the schema or application code.
- **Foreign keys use `ON DELETE RESTRICT` by default**; explicit `CASCADE` only where the child record has no independent meaning (e.g., `CartItem` cascades from `Cart`).

---

## 6. Migration Strategy

- Prisma Migrate, migrations committed to `packages/database/migrations`, one migration per PR that changes schema.
- Every migration is additive-first in production (add nullable column → backfill → make non-null → remove old column in a later migration) to support zero-downtime deploys — no destructive migration ships in the same release as the code that depends on it.
- Neon's branch-per-PR workflow (TECH_STACK.md §6) means every schema change is tested against a real isolated Postgres branch before merge.

---

## 7. Future Expansion Considerations

- **Multi-warehouse/3PL (Phase 4):** the `Warehouse`/`Inventory` split already supports this; expansion is a matter of routing logic, not schema change.
- **Multi-currency (Phase 4):** `currency` columns already exist on `Product`, `Order`, `Cart`; a `PriceList` table (variantId, currency, price) will be added to support region-specific pricing without altering base schema.
- **Multi-brand (post-launch):** `Product.brandId` is reserved now to avoid a painful migration later, even though SILONYA is single-brand at launch.
- **Sharding/partitioning:** `Order` and `OrderStatusEvent` are the highest-growth tables; UUID PKs and date-based partitioning (by `placedAt`) are the planned path if/when a single Postgres instance becomes a bottleneck — not implemented until evidence requires it, per ROADMAP.md's scalability principle.
