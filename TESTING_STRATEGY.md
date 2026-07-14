# SILONYA — Testing Strategy

Defines how correctness is verified across the SILONYA codebase, enforcing the quality bar set in [PROJECT_RULES.md](./PROJECT_RULES.md) §6.

---

## 1. Testing Philosophy

1. **Test in proportion to risk, not in proportion to lines of code.** Checkout, payments, and inventory logic are tested exhaustively; a static marketing section is not.
2. **Tests document behavior.** A good test tells the next engineer what the system is supposed to do, not just that it currently does something.
3. **The testing pyramid, not an hourglass.** Many fast unit tests, a meaningful layer of integration tests, a lean set of high-value E2E tests — not the inverse.
4. **A failing test blocks merge, always.** No `.skip`'d tests committed, no "known flaky, ignore it" tolerated — a flaky test is a bug in the test, fixed or removed, not silenced.

---

## 2. Testing Pyramid

```
                    ▲
                   ╱ ╲            E2E (Playwright)
                  ╱───╲           ~30-50 critical-path tests
                 ╱     ╲
                ╱───────╲         Integration (Vitest + real test DB)
               ╱         ╲        API routers, DB transactions, webhook handlers
              ╱───────────╲
             ╱             ╲      Unit (Vitest + React Testing Library)
            ╱───────────────╲     Business logic, components, utilities
           ╱───────────────────╲
```

| Layer       | Tooling                                                       | What it covers                                                                                                | Speed                            |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Unit        | Vitest, React Testing Library                                 | Pure functions (pricing, formatting), business logic in isolation, individual component rendering/interaction | Milliseconds, runs on every save |
| Integration | Vitest + a real Postgres test database (Neon branch or local) | tRPC procedures end-to-end against the DB, Prisma queries, webhook handler logic, transaction correctness     | Seconds                          |
| End-to-End  | Playwright                                                    | Full user journeys through a real browser against a deployed preview environment                              | Minutes, runs in CI per PR       |

---

## 3. Unit Testing

- **Business logic** (`packages/api`, `packages/utils`): pricing calculations, discount eligibility rules, inventory availability math, order status transition validity — 100% of branches in money/inventory-affecting logic covered, since these are exactly the functions DATABASE_ARCHITECTURE.md §1 identifies as needing correctness guarantees.
- **Components** (`packages/ui`, app components): rendered via React Testing Library, tested by user-visible behavior (role/text queries) rather than implementation details (no snapshot-testing internal component structure, which breaks on harmless refactors and provides little real signal).
- **Coverage target:** no blanket percentage mandate — coverage is a diagnostic, not a goal in itself. Reviewed per-PR: does the changed logic have tests proportional to its risk (§1)? A 100% coverage number on trivial code is not the bar; untested checkout logic is always a blocker regardless of overall project coverage.

---

## 4. Integration Testing

- Every tRPC procedure that mutates data (`cart.addItem`, `checkout.createIntent`, `admin.orders.updateStatus`, etc.) has an integration test exercising it against a real (ephemeral, seeded) Postgres database — not a mocked DB, since the risk we're protecting against (DATABASE_ARCHITECTURE.md §5's transactional guarantees, oversell prevention) only manifests against real transactional behavior.
- **Concurrency tests** specifically target the oversell-prevention logic (PRODUCT_SYSTEM.md §4.3): simulate concurrent checkout attempts against limited stock and assert exactly the available quantity succeeds, never more.
- **Webhook handlers** (PAYMENT_ARCHITECTURE.md §3) are tested with recorded/representative Stripe event payloads, including idempotency (replaying the same event twice produces no duplicate side effects) and signature-rejection cases.
- Test database is a Neon branch spun up per CI run (mirroring the preview-environment pattern in TECH_STACK.md §6) — isolated, disposable, always migrated to the current schema.

---

## 5. End-to-End Testing

Playwright, run against a real deployed preview environment (not local dev), covering critical revenue-path journeys:

- Browse → PDP → add to cart → guest checkout → payment (Stripe test mode) → order confirmation
- Browse → PDP → add to cart → account login → checkout with saved address → order confirmation
- Search → filter → PDP (SEARCH_AND_FILTERS.md flows)
- Account: registration, login, password reset, order history view
- Admin: login with 2FA, create/publish a product, process an order, issue a refund
- Failure paths deliberately included, not just happy paths: declined card, out-of-stock at checkout, invalid discount code, expired session mid-checkout

E2E tests run on every PR against its preview deployment (PROJECT_RULES.md §6) and are kept deliberately lean — E2E is the most expensive, slowest, most brittle layer, reserved for journeys where nothing less than a real browser interaction proves the system works.

---

## 6. Accessibility Testing

- **Automated:** `axe-core` integrated into both component tests (via `jest-axe`/`vitest-axe` equivalent) and Playwright E2E runs — catches contrast, missing labels, ARIA misuse automatically in CI (DESIGN_SYSTEM.md §6).
- **Manual:** screen reader pass (VoiceOver + NVDA) required before shipping checkout or account flow changes, per PROJECT_RULES.md §6's pre-production checklist — automated tools catch maybe half of real accessibility issues; manual testing catches the rest.

---

## 7. Performance Testing

- **Lighthouse CI** runs against key templates (home, PLP, PDP, cart, checkout) on every PR, failing the build on regression beyond the budgets in PROJECT_RULES.md §7.
- **Load testing** (k6 or similar) against checkout and search endpoints performed before major traffic events (launch, planned marketing pushes) — not a continuous CI gate, but a deliberate pre-event exercise, validating the oversell-prevention and rate-limiting behavior (§4, API_SPECIFICATION.md §5) under real concurrency.

---

## 8. Visual Regression (Design System Integrity)

- `packages/ui` components have visual regression coverage (e.g., Chromatic against Storybook, or Playwright screenshot comparison) so a shared-component change can't silently break the storefront's visual consistency across every page that uses it — directly protecting DESIGN_SYSTEM.md's "consistency compounds" principle.

---

## 9. CI Gate Summary

Every PR must pass, before merge is possible (PROJECT_RULES.md §6):

1. Lint + typecheck
2. Unit tests
3. Integration tests (against ephemeral test DB)
4. Build succeeds
5. Automated accessibility checks
6. Lighthouse CI (performance budgets)
7. E2E critical-path suite (against the PR's preview deployment)

A red build is never merged around — "I'll fix it in a follow-up" is not an accepted reason to bypass a failing check.

---

## 10. Test Data & Environments

- **Seed data** (`packages/database/seed`) provides a realistic-but-fake catalog, test users, and Stripe test-mode payment scenarios for local development and CI — never production data copied into lower environments.
- **Stripe test mode** used in all non-production environments exclusively; live keys exist only in production (PAYMENT_ARCHITECTURE.md §8).

---

## 11. Future Expansion

- **Mutation testing** (e.g., Stryker) considered for the highest-risk packages (`packages/api` pricing/inventory logic) once the core test suite is mature, to verify tests actually catch the bugs they're meant to, not just achieve coverage numbers.
- **Contract testing** for the public REST API, once external partner integrations exist (Phase 5+), to guarantee backward compatibility across API versions (API_SPECIFICATION.md §7).
