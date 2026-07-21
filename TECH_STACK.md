# SILONYA — Technology Stack

This document defines the complete technical architecture for SILONYA. It is the authoritative reference for all technology decisions. Any deviation from this stack requires a documented justification and update to this file before implementation.

---

## 1. Architecture Overview

SILONYA is built as a **TypeScript-first monorepo** using a full custom stack — no headless commerce platform (Shopify/BigCommerce) dependency. This maximizes control over UX, performance, data ownership, and long-term cost-of-scale, at the cost of building more ourselves. This tradeoff is intentional: the storefront experience _is_ the product differentiator.

```
                         ┌─────────────────────────┐
                         │        Customers         │
                         └────────────┬─────────────┘
                                      │
                     ┌────────────────┴────────────────┐
                     │        Edge / CDN (Vercel)        │
                     └────────────────┬────────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        │                     apps/web (Next.js)                     │
        │        Storefront — SSR/SSG, App Router, Route Handlers    │
        └──────────────────────────────┬──────────────────────────────┘
                                       │  tRPC / REST (internal)
        ┌──────────────────────────────┴──────────────────────────────┐
        │                   apps/admin (Next.js)                       │
        │        Internal dashboard — catalog, orders, CMS, CRM        │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        │                     Service Layer (Node.js)                  │
        │   Auth · Catalog · Cart · Orders · Payments · Notifications  │
        └───────┬─────────────┬─────────────┬─────────────┬────────────┘
                │             │             │             │
         ┌──────┴────┐ ┌──────┴─────┐ ┌─────┴──────┐ ┌────┴─────┐
         │ PostgreSQL │ │   Redis    │ │  Search    │ │  Queue   │
         │  (Prisma)  │ │ (cache/    │ │ (Meilisearch)│ │(BullMQ) │
         │            │ │  sessions) │ │            │ │          │
         └────────────┘ └────────────┘ └────────────┘ └──────────┘

  External services: Stripe (payments) · Resend (email) · Cloudinary (media)
                      · Sentry (errors) · PostHog (analytics)
```

---

## 2. Core Stack

### Frontend

| Layer                | Choice                                               | Why                                                                                             |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Framework            | **Next.js 15 (App Router)**                          | SSR/SSG/ISR for SEO and performance; React Server Components reduce client JS                   |
| Language             | **TypeScript (strict mode)**                         | Type safety across the whole stack, shared types with backend                                   |
| Styling              | **Tailwind CSS** + custom design tokens              | Fast, constrained, consistent; enforces the design system rather than fighting it               |
| Component primitives | **shadcn/ui** (Radix UI underneath), fully re-themed | Accessible, unstyled primitives we skin to SILONYA's design language — never used off-the-shelf |
| Animation            | **Framer Motion**                                    | Editorial-grade transitions and micro-interactions, used sparingly and purposefully             |
| Client state         | **Zustand**                                          | Minimal, for cart/UI state only — not a replacement for server state                            |
| Server/data state    | **TanStack Query**                                   | Caching, revalidation, optimistic updates for client-fetched data                               |
| Forms                | **React Hook Form + Zod**                            | Type-safe validation shared between client and server                                           |

### Backend

| Layer            | Choice                                                                                                   | Why                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime          | **Node.js (LTS) + TypeScript**                                                                           | Shared language/types across the stack                                                                                                                                                                                                                                                                                                                                                                         |
| API layer        | **tRPC** (internal) + **REST route handlers** (webhooks/external)                                        | End-to-end type safety for internal calls; REST where external systems require it                                                                                                                                                                                                                                                                                                                              |
| ORM              | **Prisma**                                                                                               | Type-safe schema, migrations, and query builder against PostgreSQL                                                                                                                                                                                                                                                                                                                                             |
| Database         | **PostgreSQL** (Neon or RDS)                                                                             | Relational integrity for orders/inventory/payments; serverless-friendly branch-per-PR workflow via Neon                                                                                                                                                                                                                                                                                                        |
| Cache / sessions | **Redis** (Upstash)                                                                                      | Cart sessions, rate limiting, hot product/catalog cache                                                                                                                                                                                                                                                                                                                                                        |
| Search           | **Meilisearch** (self-hosted or cloud)                                                                   | Fast typo-tolerant product search & faceted filtering; Algolia as a paid upgrade path if scale demands it                                                                                                                                                                                                                                                                                                      |
| Background jobs  | **BullMQ** on Redis                                                                                      | Order processing, emails, inventory sync, webhook retries                                                                                                                                                                                                                                                                                                                                                      |
| Auth             | **Auth.js (NextAuth)** with JWT + secure httpOnly cookies                                                | Email/password + Google/Apple OAuth; session strategy suited to edge + serverless                                                                                                                                                                                                                                                                                                                              |
| Payments         | **Stripe** (Payment Intents, Stripe Tax, Stripe Checkout for launch → custom Elements checkout post-MVP) | Industry standard, PCI compliance offloaded, native multi-currency support                                                                                                                                                                                                                                                                                                                                     |
| Testing          | **Vitest**                                                                                               | Native ESM/TS support matches every package's `"type": "module"`; faster than Jest for this stack. Unit-tests the pure/mockable business logic PROJECT_RULES.md §1 requires (`packages/utils`, `packages/api`) — config shared via `packages/config/vitest/base.ts`, same pattern as the shared ESLint/TypeScript configs. Component/E2E coverage for `apps/web`/`apps/admin` is not yet set up (Phase 11 gap) |

### Infrastructure

| Layer                  | Choice                                | Why                                                                     |
| ---------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Hosting (web/admin)    | **Vercel**                            | Native Next.js support, global edge network, preview deployments per PR |
| Database hosting       | **Neon** (serverless Postgres)        | Branching per environment/PR, scales to zero in dev                     |
| Media storage/CDN      | **Cloudinary**                        | On-the-fly image transforms, responsive image delivery, AVIF/WebP       |
| Transactional email    | **Resend** + **React Email**          | Type-safe email templates as React components                           |
| Error monitoring       | **Sentry**                            | Frontend + backend error tracking with source maps                      |
| Product analytics      | **PostHog**                           | Funnel analysis, session replay, feature flags                          |
| Uptime/perf monitoring | **Vercel Analytics + Speed Insights** | Real-user Core Web Vitals monitoring                                    |
| CI/CD                  | **GitHub Actions**                    | Lint/typecheck/test on every PR; Vercel handles deploy                  |

---

## 3. Repository Structure

Monorepo managed with **pnpm workspaces + Turborepo**.

```
silonya/
├── apps/
│   ├── web/                 # Customer-facing storefront (Next.js)
│   │   ├── app/              # App Router: routes, layouts, pages
│   │   ├── components/       # App-specific components (not shared)
│   │   ├── lib/               # App-specific utilities, hooks
│   │   └── public/
│   │
│   └── admin/                # Internal admin dashboard (Next.js)
│       ├── app/
│       ├── components/
│       └── lib/
│
├── packages/
│   ├── ui/                   # Shared design system components (buttons, inputs, cards…)
│   ├── database/             # Prisma schema, migrations, seed scripts
│   ├── api/                  # tRPC routers, service layer (catalog, cart, orders…)
│   ├── auth/                 # Shared auth logic/config
│   ├── emails/               # React Email templates
│   ├── config/                # Shared eslint, tsconfig, tailwind config
│   └── utils/                 # Shared types, constants, helper functions
│
├── docs/                      # This documentation suite
├── infra/                     # IaC / deployment configuration (future)
├── .github/workflows/         # CI pipelines
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Rule:** anything used by more than one app belongs in `packages/`, never duplicated. See [PROJECT_RULES.md](./PROJECT_RULES.md) for enforcement details.

---

## 4. Data Architecture (High-Level)

Core entities anticipated in the Prisma schema (finalized during Phase 1 — see ROADMAP.md):

- **User** — customer accounts, auth identities, addresses
- **Product / ProductVariant** — catalog, options (size/color), pricing, media
- **Collection** — curated groupings for editorial/merchandising
- **Inventory** — stock levels per variant per warehouse/region
- **Cart / CartItem** — active shopping sessions (Redis-backed with Postgres persistence for logged-in users)
- **Order / OrderItem / OrderStatusHistory** — immutable record of completed transactions
- **Payment** — Stripe payment intent references, never raw card data
- **Address** — shipping/billing, normalized and reusable
- **Discount / Promotion** — codes, rules, eligibility
- **Review** — post-purchase product reviews (Phase 3+)
- **AdminUser / Role** — RBAC for the admin app

**Principle:** the database is the source of truth for money and inventory. Nothing that affects an order total or stock count is ever computed client-side and trusted.

---

## 5. Third-Party Services Summary

| Purpose                   | Service                       | Notes                                                        |
| ------------------------- | ----------------------------- | ------------------------------------------------------------ |
| Payments                  | Stripe                        | PCI-DSS compliance handled by Stripe; multi-currency native  |
| Tax calculation           | Stripe Tax                    | Avoids building global tax logic in-house                    |
| Shipping rates            | Shippo or EasyPost (Phase 2+) | Rate shopping across carriers                                |
| Email                     | Resend                        | Transactional (order confirmation, shipping, password reset) |
| Search                    | Meilisearch                   | Self-hosted initially, evaluate Algolia at scale             |
| Media/CDN                 | Cloudinary                    | Image optimization and delivery                              |
| Error tracking            | Sentry                        |                                                              |
| Analytics                 | PostHog + Vercel Analytics    | Product + web vitals                                         |
| Customer support (future) | Zendesk/Front (TBD Phase 3)   | Not required for MVP                                         |

---

## 6. Environments

| Environment  | Purpose                      | Deploy trigger                            |
| ------------ | ---------------------------- | ----------------------------------------- |
| `local`      | Developer machines           | N/A                                       |
| `preview`    | Per-PR ephemeral environment | Every pull request (Vercel + Neon branch) |
| `staging`    | Pre-production QA            | Merge to `develop`                        |
| `production` | Live site                    | Merge to `main`, manual approval gate     |

---

## 7. Why Not X? (Decision Log)

- **Why not Shopify/headless Shopify?** Faster to launch, but caps control over checkout UX, data ownership, and long-term platform fees at scale. SILONYA's differentiation _is_ the experience, so we own the full stack.
- **Why not a monolith (single Next.js app)?** The admin dashboard has a different security surface, deploy cadence, and access model than the storefront. Separating apps now avoids a painful split later, while packages/ still keeps logic shared.
- **Why not microservices from day one?** Premature for current scale. The service layer in `packages/api` is structured so it _can_ be extracted into standalone services later without a rewrite (see ROADMAP.md §Scalability Strategy).
- **Why Prisma + PostgreSQL over a NoSQL store?** Orders, inventory, and payments are inherently relational and require strong consistency guarantees. NoSQL is not a good fit for financial correctness.

This document will be updated as decisions evolve. Any change to the core stack must be discussed and reflected here before implementation begins.
