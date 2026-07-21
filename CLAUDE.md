# CLAUDE.md

Operating instructions for Claude Code (and any AI pair-programmer) working in the SILONYA repository. Read this first in every session.

---

## What SILONYA Is

A premium global fashion e-commerce platform, single-brand D2C, built as a custom TypeScript monorepo (Next.js + Node + PostgreSQL). Full context: [README.md](./README.md). The experience _is_ the product differentiator — treat performance, polish, and correctness as equally non-negotiable, not tradeable against each other.

---

## Source of Truth

Before making any non-trivial decision, consult the relevant document rather than inferring from general best practices:

| Question                                                        | Document                                     |
| --------------------------------------------------------------- | -------------------------------------------- |
| "What are we building and for whom?"                            | [README.md](./README.md)                     |
| "What tech/library/pattern should I use?"                       | [TECH_STACK.md](./TECH_STACK.md)             |
| "How should this component/file/branch be structured or named?" | [PROJECT_RULES.md](./PROJECT_RULES.md)       |
| "What should this look/feel like?"                              | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)       |
| "Is this in scope for the current phase?"                       | [ROADMAP.md](./ROADMAP.md)                   |
| "How should this be tested?"                                    | [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) |

If a task conflicts with one of these documents, flag the conflict to the user rather than silently picking one side.

---

## Current Project Status

**Phase 2/3 (in progress) — MVP Storefront + Growth Features.** The monorepo, admin catalog/order/customer/review/discount/gift-card/content/analytics management, guest+account checkout (Stripe test mode), search (Meilisearch-ready with a Postgres fallback), a lightweight CMS (hero/promo/editorial blocks, static/editorial/lookbook pages, FAQ, footer), admin analytics/reports (CSV/Excel), and the customer-facing storefront (browsing, accounts, wishlist, reviews, coupons, gift cards, search, CMS pages) are all built and runtime-verified against a real Neon Postgres database. Security headers (CSP/HSTS), in-memory rate limiting, error boundaries, and health-check endpoints are live on both apps. Check [ROADMAP.md](./ROADMAP.md) for the authoritative, up-to-date checklist of what's done vs. outstanding per phase — verify against the actual repository state rather than trusting this file's memory of it, since this file is not guaranteed to be updated the moment the phase changes. Notable gaps as of the last update: a real Meilisearch/Redis/PostHog/Sentry instance (all code-ready, none provisioned in this environment), Google/Apple OAuth (needs real provider credentials), Resend (email sending stubbed/logged pending an API key), Core Web Vitals/accessibility audits, nonce-based CSP script-src, and a formal pre-launch security review. Testing (`testing-foundation` tag): Vitest is wired in with unit coverage of the money-critical logic in `packages/utils`/`packages/api` (TESTING_STRATEGY.md §3) — do not assume this means broader coverage exists; the integration (§4), E2E (§5), accessibility (§6), Lighthouse (§7), and visual-regression (§8) layers of that doc's pyramid are still unbuilt, and most business logic elsewhere in the codebase (including all of `apps/web`/`apps/admin`) remains untested.

**Standing rule:** the documentation-only gate has passed — application code is expected. Still check the roadmap phase before building something out of order (e.g., a Phase 4 multi-currency feature while Phase 2 exit criteria remain open).

---

## Non-Negotiables

These apply to every piece of work, regardless of how small the task seems:

1. **TypeScript strict, no `any`** without explicit justification (PROJECT_RULES.md §1).
2. **Never trust client-supplied prices, totals, or stock counts.** Always recalculate/verify server-side (PROJECT_RULES.md §8).
3. **No card data touches our servers** — Stripe Elements/Checkout only.
4. **Accessibility (WCAG 2.1 AA) is part of "done,"** not a follow-up pass (DESIGN_SYSTEM.md §6).
5. **Performance budgets are a spec, not a suggestion** (PROJECT_RULES.md §7) — don't ship a heavy dependency or unoptimized asset "to fix later."
6. **Shared code goes in `packages/`, never duplicated** between `apps/web` and `apps/admin`.
7. **Every PR-bound change needs tests appropriate to its risk** — business logic (pricing, inventory, checkout) is never merged untested.
8. **Follow Conventional Commits and the branch naming scheme** (PROJECT_RULES.md §5) without being asked each time.

---

## How to Work in This Repo

- **Check the roadmap phase before building.** Building a Phase 3 feature (reviews, wishlists) while Phase 1 infrastructure is incomplete is out of order — flag it rather than doing it.
- **Prefer extending existing patterns over inventing new ones.** If a similar component/hook/service already exists, follow its shape unless there's a documented reason not to (then update PROJECT_RULES.md so the new pattern becomes the standard, not a one-off).
- **Don't add abstractions ahead of need.** Two similar implementations is fine; a generic framework for a hypothetical third case is not, per the project's general engineering philosophy.
- **When a decision isn't covered by these docs**, make the smallest reasonable call, note the assumption in the PR description, and suggest whether it's worth codifying into PROJECT_RULES.md or TECH_STACK.md.
- **Verify before claiming done.** Run lint/typecheck/tests locally, and for UI changes, actually run the dev server and look at the result — don't report a task complete on the basis of code compiling alone.

---

## What NOT to Do

- Do not introduce a new major dependency (state library, UI kit, ORM, etc.) without checking it against [TECH_STACK.md](./TECH_STACK.md) — if it's not there, that's a signal to raise it with the user, not silently add it.
- Do not use a headless commerce platform, page builder, or third-party checkout widget — the whole point of the custom stack is full control (TECH_STACK.md §7).
- Do not build features not yet reached in the roadmap "while we're at it."
- Do not weaken the security or accessibility rules for convenience or speed, even temporarily — there's no "fix it later" for a checkout security gap.
- Do not commit directly to `main` or `develop`, skip CI, or bypass required reviews.

---

## Keeping This File Current

Update this file when:

- The current roadmap phase changes.
- A non-negotiable rule is added, changed, or retired in PROJECT_RULES.md/TECH_STACK.md and should be reflected here.
- A recurring mistake pattern emerges that future sessions should be warned about proactively.

This file should stay short and high-signal — it's a map to the other documents, not a duplicate of them.
