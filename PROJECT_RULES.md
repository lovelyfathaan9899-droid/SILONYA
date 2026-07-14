# SILONYA — Project Rules

Binding engineering standards for the SILONYA codebase. Every contributor (human or AI) follows these rules. Where this document and personal preference disagree, this document wins — raise a discussion to change the rule, don't silently deviate.

---

## 1. Coding Standards

### General

- **TypeScript strict mode everywhere.** `any` is banned except in narrowly justified, commented cases (e.g., typing a third-party library with no types). Prefer `unknown` + narrowing.
- **No implicit business logic in components.** UI components render and emit events; business logic (pricing, inventory rules, validation) lives in `packages/api` or `packages/utils`, is unit-tested, and is imported — never duplicated.
- **Pure functions by default.** Side effects (network calls, mutations) are isolated to clearly named functions/hooks (`useAddToCart`, `createOrder`), not scattered through render logic.
- **Explicit over clever.** Optimize for the next reader, not for fewest keystrokes. No clever one-liners that trade readability for brevity.
- **No dead code.** Delete unused code rather than commenting it out. Git history is the record of what used to exist.
- **Comments explain _why_, not _what_.** A comment justified only by "this line adds two numbers" should not exist. Document non-obvious constraints, workarounds, and invariants only.

### Linting & Formatting

- **ESLint + Prettier**, config lives in `packages/config`, inherited by every app/package — no per-app overrides without a documented reason.
- **Pre-commit hook** (Husky + lint-staged) runs lint + format on staged files. CI re-runs full lint/typecheck as the source of truth.
- Zero warnings policy in CI — a warning is a failed build, not a suggestion.

---

## 2. Naming Conventions

| Entity                       | Convention                                                     | Example                                             |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| React components             | `PascalCase`, file matches component name                      | `ProductCard.tsx`                                   |
| Hooks                        | `camelCase`, prefixed `use`                                    | `useCartStore.ts`                                   |
| Utility functions            | `camelCase`, verb-first                                        | `formatPrice.ts`, `calculateShipping.ts`            |
| Types & interfaces           | `PascalCase`, no `I` prefix                                    | `type ProductVariant`, not `IProductVariant`        |
| Constants                    | `SCREAMING_SNAKE_CASE` for true constants                      | `MAX_CART_ITEMS`                                    |
| Database models (Prisma)     | `PascalCase` singular                                          | `model Order`, not `Orders`                         |
| Database columns             | `camelCase` (Prisma default, maps to `snake_case` in Postgres) | `createdAt`                                         |
| API routes / tRPC procedures | `camelCase`, resource.action pattern                           | `product.getBySlug`, `cart.addItem`                 |
| CSS/Tailwind design tokens   | `kebab-case`, prefixed by category                             | `--color-ink`, `--space-4`                          |
| Branches                     | `type/short-description`                                       | `feat/product-detail-page`, `fix/cart-quantity-bug` |
| Files (non-component)        | `kebab-case`                                                   | `format-price.ts`, `use-cart-store.ts`              |

**Rule of thumb:** name things for what they _are_, not how they're currently used. `ProductCard`, not `HomepageGridItem`.

---

## 3. Component Architecture Rules

(Full design-system-level detail in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §3.)

- Components follow the four-tier model: **Primitive → Pattern → Section → Template.**
- A component's tier determines what it's allowed to do:
  - Primitives: styling only, no data, no business logic.
  - Patterns: presentational composition, props-driven, no direct data fetching.
  - Sections: may fetch/subscribe to data via hooks; own a bounded piece of a page.
  - Templates: compose sections into a full route; live in `apps/*/app`, not in `packages/ui`.
- **Shared = `packages/ui`. App-specific = the app.** If a component is used by both `web` and `admin`, it belongs in `packages/ui`, no exceptions, no copy-pasting "just this once."
- Every exported component has a typed `Props` interface — no inline anonymous prop types on exported components.
- Co-locate a component's styles, tests, and stories with the component itself, not in parallel directory trees.

---

## 4. Folder Structure & File Organization

See [TECH_STACK.md](./TECH_STACK.md) §3 for the full repository layout. Rules on top of that structure:

- No file exceeds ~300 lines as a soft guideline — if it does, it's a signal to extract logic, not a hard blocker for genuinely cohesive files.
- One default export per file for components; utilities may have multiple named exports.
- Barrel files (`index.ts` re-exports) are allowed at the package boundary (`packages/ui/index.ts`) but not encouraged inside a package's internals — prefer direct imports to keep dependency graphs traceable.
- Tests live next to the code they test: `format-price.ts` + `format-price.test.ts`.

---

## 5. Git Workflow

- **Trunk-based development** with short-lived feature branches off `develop`; `main` is production, always deployable.
- **Branch naming:** `type/short-description` — types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`.
- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat(cart): add quantity stepper`, `fix(checkout): correct tax rounding`.
- **Pull requests required for everything** — no direct commits to `develop` or `main`.
  - At least one approving review required.
  - CI (lint, typecheck, unit tests, build) must pass before merge.
  - PRs should be small and reviewable — one logical change per PR, not a batch of unrelated fixes.
- **`develop` → `staging`** deploys automatically on merge; **`main` → `production`** requires a manual promotion after staging QA sign-off.
- No force-push to `main`/`develop`. No merge commits with unresolved conflicts glossed over — resolve deliberately.
- Tag releases on `main` using semantic versioning (`v1.2.0`) once the platform is live.

---

## 6. Quality Assurance Process

1. **Automated gate (every PR):** lint, typecheck, unit tests, build, and automated accessibility checks (axe) must all pass in CI.
2. **Preview environment:** every PR deploys to an isolated Vercel preview + Neon DB branch for manual review — no "works on my machine."
3. **Manual QA (pre-staging promotion):** functional walkthrough of the affected flow, cross-browser check (Chrome, Safari, Firefox), mobile device check (iOS Safari, Android Chrome).
4. **Pre-production checklist (before promoting to `main`):**
   - [ ] Core Web Vitals within budget on the changed pages (see §7)
   - [ ] Accessibility manual pass for new/changed flows
   - [ ] No console errors/warnings
   - [ ] Checkout and payment flows explicitly retested if touched, including failure paths (declined card, out-of-stock at checkout)
5. **Post-deploy monitoring:** Sentry error rate and Vercel Web Vitals watched for regression in the first 24 hours after a production release; rollback plan is "revert the merge commit," not hotfix-under-pressure.

---

## 7. Performance Standards

| Metric                              | Budget                               |
| ----------------------------------- | ------------------------------------ |
| Largest Contentful Paint (LCP)      | < 2.5s (mobile, mid-tier device, 4G) |
| Interaction to Next Paint (INP)     | < 200ms                              |
| Cumulative Layout Shift (CLS)       | < 0.1                                |
| Lighthouse Performance score        | ≥ 90 on PLP/PDP/homepage             |
| JS bundle (initial load, per route) | < 200KB gzipped as a soft target     |
| Time to first byte (TTFB)           | < 600ms                              |

**Enforcement:**

- Lighthouse CI runs on every PR against key templates (home, PLP, PDP, cart, checkout) and fails the build on regression beyond a defined threshold.
- Images: always via `next/image`, always with explicit `sizes`, always AVIF/WebP via Cloudinary.
- Fonts: self-hosted/subset, `font-display: swap`, preloaded for above-the-fold text.
- Third-party scripts (analytics, etc.) are loaded via `next/script` with the least-blocking strategy that meets the need, and audited quarterly — anything not earning its performance cost is removed.

---

## 8. Security Standards

- **No card data ever touches our servers.** Stripe Elements/Checkout only; we store Stripe references, never PANs.
- **Secrets management:** all API keys/secrets in environment variables via Vercel/1Password, never committed. `.env.example` documents required vars with no real values.
- **AuthN/AuthZ:** httpOnly, secure, SameSite cookies for sessions; role-based access control on all admin endpoints; every admin API route re-validates permissions server-side (never trust client-side role checks alone).
- **Input validation:** all external input (forms, webhooks, query params) validated with Zod schemas at the API boundary — never trust client-supplied data, including prices/totals, which are always recalculated server-side.
- **OWASP Top 10 baseline:** parameterized queries via Prisma (no raw SQL string concatenation), CSRF protection on state-changing requests, rate limiting on auth/checkout endpoints (Redis-backed), security headers (CSP, HSTS, X-Frame-Options) set at the edge.
- **Dependency hygiene:** automated dependency vulnerability scanning (Dependabot/Snyk) in CI; critical vulnerabilities block merges.
- **PII & compliance:** GDPR/CCPA-aware data handling — customer data export/delete endpoints planned by the time we serve EU/CA customers; data encrypted at rest (managed by Postgres provider) and in transit (TLS everywhere).
- **Webhook verification:** all inbound webhooks (Stripe, shipping carriers) verify signatures before processing — no unauthenticated webhook is ever trusted.

Full security review is a required step before any production launch — see [ROADMAP.md](./ROADMAP.md).

---

## 9. SEO Standards

(Strategy detail in [ROADMAP.md](./ROADMAP.md); this section covers implementation rules.)

- Every route rendered SSR or SSG — no critical content behind client-side-only fetches.
- Semantic HTML structure (`h1`–`h6` hierarchy respected, one `h1` per page).
- Structured data (JSON-LD): `Product`, `BreadcrumbList`, `Organization`, `Offer` schemas on relevant pages.
- Canonical URLs on every page; `hreflang` tags once multi-region launches.
- Auto-generated `sitemap.xml` and `robots.txt`, kept in sync with the live catalog.
- Meta titles/descriptions are unique per product/collection page, never templated boilerplate with just the name swapped.
- All images have descriptive `alt` text (also an accessibility requirement, see DESIGN_SYSTEM.md §6).

---

## 10. Definition of Done

A piece of work is not "done" until it:

1. Meets the acceptance criteria of its ticket/spec.
2. Passes all automated checks in §6.
3. Is accessible per DESIGN_SYSTEM.md §6.
4. Is within the performance budgets in §7.
5. Has been reviewed and approved via PR.
6. Has no known regressions on the preview deployment.
