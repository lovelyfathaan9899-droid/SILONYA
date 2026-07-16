# SILONYA — Admin Panel Architecture

Defines `apps/admin` — the internal dashboard staff use to run the business. Built on the same monorepo stack (TECH_STACK.md), sharing `packages/ui` and `packages/api` with the storefront, but deployed and access-controlled as an entirely separate application.

---

## 1. Purpose & Principles

1. **Operational tool, not a marketing surface.** Admin UX prioritizes density, speed, and correctness over the storefront's editorial restraint — different design goals from DESIGN_SYSTEM.md's customer-facing rules, though it still uses SILONYA's design tokens for brand consistency.
2. **Separate deployment, separate auth domain.** `apps/admin` is a distinct Vercel project with its own domain (e.g., `admin.silonya.com`), IP-agnostic but session-isolated from the storefront (AUTHENTICATION.md §3).
3. **Every write action is permission-checked and audited.** No admin screen assumes trust based on being logged in alone — see AUTHENTICATION.md §4–5.

---

## 2. Access Control Recap

Full RBAC model defined in [AUTHENTICATION.md](./AUTHENTICATION.md) §4. Summary of how it shapes the admin UI:

- Navigation renders only sections the current admin's role has at least read access to — a `support` role never sees "Discounts" or "Settings" in the sidebar.
- This is a UX convenience only; the underlying `adminProcedure` permission check (API_SPECIFICATION.md §2) is the actual security boundary, and is enforced even if a hidden route is accessed directly.

---

## 3. Information Architecture

```
Admin Dashboard
├── Overview            (KPI summary: today's orders, revenue, low stock alerts)
├── Orders
│   ├── Order list (search/filter by status, date, customer)
│   └── Order detail (items, status history, payment, refund actions, notes)
├── Catalog
│   ├── Products (list, create, edit, publish/archive)
│   ├── Collections
│   ├── Categories
│   └── Inventory (stock levels, low-stock alerts, per-warehouse view)
├── Customers
│   ├── Customer list/search
│   └── Customer detail (order history, addresses — read-mostly, support tooling)
├── Discounts            (create/manage promo codes)
├── Gift Cards            (issue, adjust balance, deactivate)
├── Reviews               (moderation queue)
├── Content               (hero/promo/editorial blocks, static/editorial/lookbook pages, FAQ, footer links)
├── Search                (index status/reindex, popular + zero-result queries)
├── Analytics             (revenue/orders/customers/inventory/best-sellers/conversion-proxy/coupon+gift-card usage)
├── Reports               (daily/weekly/monthly CSV/Excel export)
├── Team & Roles          (AdminUser management, role assignment — super_admin only)
└── Audit Log              (searchable AuditLogEntry viewer — super_admin, order_manager)
```

---

## 4. Core Modules

### 4.1 Overview

- Real-time-ish (minute-level, cached) KPIs: today/week revenue, order count, conversion rate (from PostHog), low-stock alert count.
- Not a full BI tool — deep analytics live in PostHog directly; this is an at-a-glance operational summary.

> **Implementation status (Phase 10):** the full KPI set (revenue by day, orders by status, best sellers, low stock, coupon/gift-card usage) is built as its own `/analytics` dashboard (`adminAnalytics.*`, `analytics:read` permission) rather than folded into the overview page — same "at-a-glance operational summary" scope, not a BI tool (no new charting dependency; a small dependency-free bar chart component covers the one visualization used). Conversion rate is a **proxy** (paid orders ÷ new accounts over the window), clearly labeled as such — PostHog isn't configured in this environment, so a true visit-to-purchase rate isn't computable yet. `/reports` generates the same aggregates as a point-in-time daily/weekly/monthly CSV/Excel download (`apps/admin/app/api/reports/route.ts`).

### 4.2 Order Management

- List view: cursor-paginated, filterable by status/date range/search (order number, customer email).
- Detail view: full `OrderItem` breakdown, `OrderStatusEvent` timeline, linked `Payment`/`Refund` records, shipping address, internal staff notes (never customer-visible).
- Actions: update fulfillment status (with tracking number entry), issue full/partial refund (PAYMENT_ARCHITECTURE.md §5), resend confirmation email, cancel (pre-fulfillment only — ORDER_MANAGEMENT.md §6).
- Every action here maps 1:1 to an `admin.orders.*` tRPC procedure (API_SPECIFICATION.md §2) requiring `orders:write`/`refunds:write`.

### 4.3 Catalog Management

- Product create/edit form maps directly to the `Product`/`ProductVariant`/`ProductOption` model (DATABASE_ARCHITECTURE.md §3.2): manage options and generate variants, set pricing per variant, upload media (direct-to-Cloudinary upload widget) with **mandatory alt text field** — the form cannot be submitted without it, enforcing DESIGN_SYSTEM.md §6 accessibility requirements at the source.
- Publish action enforces the `draft → active` completeness checklist (PRODUCT_SYSTEM.md §2) — incomplete products are blocked with specific, actionable validation errors, not a generic "invalid" message.
- Inventory view: per-variant, per-warehouse stock, manual stock adjustment (with a required reason, logged to audit trail — inventory adjustments are financially significant and must be traceable), configurable low-stock threshold per variant.

### 4.4 Customer Management

- Primarily a support tool: look up a customer, see their order history and saved addresses, to answer support inquiries — not a full CRM.
- No admin can view or edit a customer's password/payment method (impossible by design — we never store either, AUTHENTICATION.md/PAYMENT_ARCHITECTURE.md).

### 4.5 Discounts

- Create/edit `Discount` records (DATABASE_ARCHITECTURE.md §3.6): code, type, value, validity window, usage limits.
- Live redemption count shown against `usageLimit` so merchandising can see uptake without a separate report.

### 4.6 Content (Phase 10 — implemented)

- Lightweight structured-content editor for editorial/lookbook pages — not a general-purpose page builder (avoids the "drag-and-drop page builder" anti-pattern that fights the design system, per DESIGN_SYSTEM.md's "confident restraint" philosophy). Content is structured fields (headline, image, body, CTA) rendered through fixed, designed templates.
- Built as: a singleton-per-type `ContentBlock` editor for the homepage's hero/promo-banner/editorial sections (`/content`); `Page` CRUD for editorial/lookbook/static pages with a draft→published gate (`/content/pages`); `FaqItem` management (`/content/faq`); `FooterLink` management (`/content/footer`), replacing the storefront's previously-hardcoded `lib/homepage-content.ts`/`lib/nav-data.ts` footer "#" placeholders with real pages. `content:read`/`content:write` permissions gate all of it. Page `body` is plain text (paragraphs split on blank lines at render time) rather than stored rich-text/HTML — deliberately avoids needing an HTML sanitizer, since there's no `dangerouslySetInnerHTML` surface to sanitize in the first place.

### 4.7 Team & Roles

- `super_admin`-only: invite new admin users (email invite flow, no public registration — AUTHENTICATION.md §3), assign roles, deactivate accounts.
- Role/permission changes are among the most sensitive admin actions and are always audit-logged (AUTHENTICATION.md §5).

### 4.8 Audit Log

- Read-only, searchable/filterable view over `AuditLogEntry` (by admin user, action type, date range) — the accountability backstop for every sensitive action taken in the admin.

---

## 5. UX Conventions

- **Data tables** are the primary interaction pattern (orders, products, customers) — consistent column sorting, filtering, and cursor pagination behavior across every list view, per PROJECT_RULES.md's consistency principle.
- **Destructive actions** (archive product, cancel order, deactivate admin) always require an explicit confirmation step describing the consequence in plain language — never a bare "Are you sure?".
- **Optimistic UI is avoided for money-affecting actions** (refunds, status changes) — the UI waits for server confirmation before showing success, given the cost of a false-positive "refund issued" state.

---

## 6. Performance & Scale Considerations

- Admin is not held to the same strict Core Web Vitals budget as the storefront (PROJECT_RULES.md §7 targets are customer-facing) — internal tool, trusted network of trained users — but cursor pagination and indexed queries (DATABASE_ARCHITECTURE.md §4) are still required so the admin stays usable as order/product volume grows into the tens of thousands.
- Bulk operations (bulk price update, bulk status export) are queued via BullMQ rather than run synchronously in a request, to avoid timeouts on large batches.

---

## 7. Future Expansion

- **Multi-warehouse fulfillment view** (Phase 4) — extends the Inventory module, not a rework.
- **Merchandising analytics** (best sellers, sell-through rate) — surfaced from the same order/inventory data, likely via a read-replica-backed reporting view once query volume justifies it (ROADMAP.md scalability principle: build for evidence, not speculation).
- **Customer service macros/ticketing integration** — if support volume grows enough to need it, integrates via the Customer Management module rather than replacing it.
