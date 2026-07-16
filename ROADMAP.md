# SILONYA — Roadmap & Scalability Strategy

This document breaks development into sequential phases, each with a clear goal and exit criteria, and defines how the platform scales beyond launch.

**Principle:** each phase ships something real and verifiable — no phase is "build infrastructure for six months with nothing to show." Phases build the minimum needed to safely support the next one.

---

## Phase 0 — Foundation

**Goal:** Align on vision, architecture, and standards before writing a single line of application code.

- [x] Define project vision, brand identity, business goals, target audience (README.md)
- [x] Define technology stack and architecture (TECH_STACK.md)
- [x] Define design system and UX principles (DESIGN_SYSTEM.md)
- [x] Define engineering standards and workflow (PROJECT_RULES.md)
- [x] Define this roadmap
- [x] Stakeholder approval of full documentation suite

**Exit criteria:** Documentation approved. No code merges to `main` until this gate passes. — met.

---

## Phase 1 — Core Infrastructure

**Goal:** Stand up the technical foundation so every subsequent phase builds on solid, tested ground.

- [x] Monorepo scaffold (pnpm + Turborepo), CI pipeline
- [x] Design tokens implemented in Tailwind config; primitive/pattern/section components in `packages/ui`
- [x] Database schema v1 (Prisma): AdminUser, Product/Variant/Option/Inventory, Category, Collection, Warehouse (Cart/Order/Address are modeled but not yet exercised by app code — Phase 2 checkout)
- [x] Auth: admin login, session management (argon2id + JWT, `packages/auth`)
- [x] Admin app scaffold with auth-gated shell, product/catalog CRUD
- [ ] Environments beyond local (preview/staging/production) — no hosting/DNS decided yet
- [ ] Brand assets finalized (logo, licensed typefaces, photography) — placeholder imagery in use throughout

**Exit criteria:** A developer can log in to a barebones admin, create a product, and see it queryable via the API. No public storefront pages yet. — met; admin catalog CRUD now goes well beyond this bar.

---

## Phase 2 — MVP Storefront (Current Phase)

**Goal:** A real, purchasable storefront — the smallest version of SILONYA that can take a live order end to end.

- [x] Homepage, Product Listing Page (PLP, collection + category), Product Detail Page (PDP)
- [x] Product cards, gallery, size/color selectors, stock status, wishlist button, search UI, empty/loading/error states (`packages/ui` Pattern/Section tiers)
- [x] Core SEO implementation: SSR/SSG+ISR, JSON-LD (Product/BreadcrumbList/Organization), `sitemap.xml`, `robots.txt`, canonical URLs
- [x] Real database provisioned (Neon) and migrated — runtime-verified: admin login, storefront SSR against live data
- [x] Cart (`/cart` page + drawer), guest checkout (shipping/billing addresses, basic tax/shipping calculation, basic coupon codes)
- [x] Stripe payment integration (Stripe Checkout, test mode), order creation, inventory deduction on payment success, order confirmation page, guest order tracking (order # + email)
- [x] Transactional emails (order confirmation, payment failed) — React Email templates built; actual delivery is stubbed (logged) pending a Resend API key
- [x] Basic admin: order management/fulfillment status (list/detail, status transitions, refunds, notes)
- [ ] Core Web Vitals budgets measured on MVP templates (see PROJECT_RULES.md §7) — not yet run against a live deployment; Phase 11 pass added DB indexes for hot analytics/report queries, confirmed no server-only dependency (exceljs, meilisearch) leaks into client bundles
- [ ] Accessibility: WCAG 2.1 AA pass on all MVP flows — built to the standard, not yet audited
- [ ] Security review before go-live (see PROJECT_RULES.md §8) — Phase 11 shipped real code-level hardening (CSP/HSTS/security headers on both apps, in-memory rate limiting on auth/checkout, error boundaries, `/api/health`) toward this; the formal external review itself is still outstanding
- [x] Customer accounts (email+password) — registration, login, password reset/change, email verification, profile, saved addresses with default shipping/billing, order history, database-backed wishlist, recently viewed (AUTHENTICATION.md, ORDER_MANAGEMENT.md §4). Google/Apple OAuth deferred — needs real provider credentials.
- [ ] Redis/BullMQ — cart persistence and webhook/email processing run without a queue for now (DATABASE_ARCHITECTURE.md §3.4, PAYMENT_ARCHITECTURE.md §3)

**Exit criteria:** A real customer can browse, purchase, and receive their order — in production, for the primary launch market/currency. — browsing is done; purchase flow is next.

---

## Phase 3 — Growth Features

**Goal:** Deepen conversion, retention, and merchandising capability now that the core loop works.

- [x] Search (Meilisearch) with faceted filtering, autocomplete, synonyms, typo tolerance, search analytics — integration code-complete (`packages/api/src/services/search-index.ts`, `routers/search.ts`); falls back to Postgres `ILIKE` until a Meilisearch instance is actually provisioned (`MEILISEARCH_HOST`/`MEILISEARCH_API_KEY` unset in this environment)
- [x] Wishlists / saved items — database-backed (`account.wishlist`), plus "save for later" from the cart
- [x] Product reviews & ratings — purchase-verified, moderation queue, review images architecture
- [x] Editorial/content pages (lookbooks, brand storytelling) via a lightweight CMS layer — hero/promo/editorial blocks, static/editorial/lookbook pages, FAQ, footer management (`adminCms`/`cms` routers, `/content` admin UI)
- [ ] Email marketing integration (abandoned cart, post-purchase flows) via a marketing ESP — transactional account/coupon/review-reminder emails exist (stubbed pending Resend); campaign-style marketing automation does not
- [x] Personalized recommendations ("You may also like") — related (category-based), trending/best-sellers (real order-data aggregation), and a first-pass purchase-history-based `recommended` query; rules-based, not ML
- [x] Discount codes & promotions engine — percentage/fixed/free-shipping, expiry, usage limits (global + per-customer), customer-specific coupons, automatic (code-less) discounts, gift cards with redemption and balance tracking
- [x] Customer account enhancements: order history, order detail/tracking — returns initiation still out of scope
- [x] Admin analytics dashboard (revenue/orders/customers/inventory/best-sellers/low-stock/coupon+gift-card usage) and daily/weekly/monthly CSV/Excel reports — an "at-a-glance operational summary" (ADMIN_PANEL.md §4.1), not a BI tool; conversion rate is a labeled proxy pending PostHog

**Exit criteria:** Repeat purchase rate and engagement metrics become trackable and improvable; the platform supports marketing-led growth, not just direct navigation.

---

## Phase 4 — Global Scale

**Goal:** Expand from single-market MVP to true global operation, per the original vision.

- Multi-currency pricing & display (Stripe multi-currency, regional price lists)
- Multi-language content (i18n framework in place from Phase 1's architecture, content populated here)
- Regional tax/duty calculation (Stripe Tax expansion, landed cost display for international orders)
- Regional shipping rates & carrier integration (Shippo/EasyPost)
- Multi-warehouse/3PL inventory support
- Performance hardening for global latency (edge caching strategy reviewed per-region)
- `hreflang` and regional SEO strategy live

**Exit criteria:** SILONYA can sell, ship, and support customers in at least 2–3 defined regions beyond the launch market with correct pricing, tax, and shipping.

---

## Phase 5 — Post-Launch Optimization

**Goal:** Move from "shipping features" to "compounding growth" via experimentation and platform maturity.

- A/B testing framework for merchandising and UX experiments
- Advanced personalization (ML-based recommendations, PostHog-driven segmentation)
- Loyalty/rewards program
- Native mobile app evaluation (React Native, sharing `packages/api` and design tokens)
- Wholesale/B2B channel evaluation (if business strategy calls for it)
- Continued performance/accessibility audits as a recurring quarterly process, not a one-time gate

---

## Scalability Strategy

SILONYA is architected so growth in traffic, catalog size, team size, and market count does not require a rewrite:

| Dimension                | Strategy                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Traffic**              | Stateless Next.js apps on Vercel's edge network scale horizontally by default; Redis absorbs cart/session read load; Postgres read replicas added when write-primary load requires it (not before).                                                    |
| **Catalog size**         | Search offloaded to Meilisearch (not Postgres `LIKE` queries) from Phase 3 onward; product images served via Cloudinary CDN, not app servers.                                                                                                          |
| **Team size**            | Monorepo with clear package boundaries (§TECH_STACK.md) lets teams own `apps/web`, `apps/admin`, or specific `packages/` independently without stepping on each other.                                                                                 |
| **Codebase complexity**  | The service layer in `packages/api` is structured by domain (catalog, cart, orders, payments) so any domain can be extracted into a standalone service later if its scaling needs diverge from the rest — without a rewrite of the surrounding system. |
| **Geographic scale**     | i18n and multi-currency are architected into the data model from Phase 1 (even though only used starting Phase 4), avoiding a retrofit. Edge deployment via Vercel keeps latency low globally by default.                                              |
| **Operational maturity** | Background jobs (BullMQ) decouple slow operations (emails, inventory sync, webhook processing) from the request/response cycle from day one, so throughput isn't bottlenecked by synchronous work as volume grows.                                     |

**Guiding rule:** build for the scale we can see (next 2 phases), architect so we're not blocked from the scale we can imagine (later phases), but never build speculative infrastructure for a scale we don't have evidence we'll reach.

---

## Timeline Note

This roadmap is intentionally **sequenced, not dated**. Each phase's exit criteria — not a calendar date — determines when the next phase begins. Specific target dates can be layered on top of this structure once team size and capacity are known; adding dates prematurely tends to produce false confidence rather than useful planning.
