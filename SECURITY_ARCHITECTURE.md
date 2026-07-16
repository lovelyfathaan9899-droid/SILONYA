# SILONYA — Security Architecture

Platform-wide security posture for SILONYA. This document consolidates and cross-references the security decisions made throughout the architecture ([AUTHENTICATION.md](./AUTHENTICATION.md), [PAYMENT_ARCHITECTURE.md](./PAYMENT_ARCHITECTURE.md), [API_SPECIFICATION.md](./API_SPECIFICATION.md), [PROJECT_RULES.md](./PROJECT_RULES.md) §8) into a single threat model and defense strategy. Security is treated as an architectural property, not a feature — it is a release blocker at every phase (ROADMAP.md).

---

## 1. Security Principles

1. **Defense in depth.** No single control is trusted as the only line of defense — network, application, and data-layer controls all assume the layer above them may fail.
2. **Least privilege everywhere.** Admin roles (AUTHENTICATION.md §4), API keys (PAYMENT_ARCHITECTURE.md §8), and infrastructure access are all scoped to the minimum required.
3. **Never trust the client.** Prices, totals, stock, permissions — every value that matters is recomputed/reverified server-side, never accepted as given (PROJECT_RULES.md §8, DATABASE_ARCHITECTURE.md §1).
4. **Secure by default, not by configuration.** Security controls (CSP, rate limiting, input validation) are baked into shared middleware/framework layers so a new feature is secure automatically, not only if the developer remembers to add a check.

---

## 2. Threat Model Summary

| Actor                                           | Motivation                                | Primary targets                |
| ----------------------------------------------- | ----------------------------------------- | ------------------------------ |
| Opportunistic attacker                          | Credential theft, carding/fraud           | Login, checkout, payment flows |
| Credential-stuffing bots                        | Account takeover at scale                 | Login endpoint                 |
| Competitor / scraper                            | Catalog/pricing data theft                | Public catalog API, search     |
| Malicious insider (low likelihood, high impact) | Data exfiltration, fraud via admin access | Admin panel, database access   |
| Supply-chain compromise                         | Inject malicious code via a dependency    | npm packages, CI pipeline      |

Full domain-specific threat/mitigation tables live in their respective documents (AUTHENTICATION.md §6, PAYMENT_ARCHITECTURE.md §8) — this document owns the cross-cutting controls below.

---

## 3. Application-Layer Security

### 3.1 Input Validation

Every external input (form submission, API param, webhook payload, query string) is validated against a Zod schema at the boundary before touching business logic (PROJECT_RULES.md §8, API_SPECIFICATION.md §2) — rejecting malformed/malicious input as early as possible, not deep inside application logic.

### 3.2 Injection Prevention

- **SQL injection:** eliminated by construction — all database access goes through Prisma's parameterized query builder; raw SQL is disallowed outside of narrowly justified, reviewed exceptions.
- **XSS:** React's default output escaping handles most cases; any `dangerouslySetInnerHTML` usage (e.g., rich-text product descriptions) passes through a strict HTML sanitizer (allowlist-based, e.g., DOMPurify) before rendering — never raw admin/user input rendered unescaped.
- **Command injection:** no application code shells out to the OS with user-influenced input; not a relevant attack surface given the stack.

### 3.3 Security Headers & CSP

Set at the edge (Next.js middleware / Vercel config) on every response:

- `Content-Security-Policy` — strict allowlist for scripts/styles/frames; no `unsafe-inline` for scripts (nonces used where inline scripts are unavoidable, e.g., structured data).
- `Strict-Transport-Security` — HSTS with a long max-age, enforced across the whole domain.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`.

> **Implementation status (Phase 11):** headers are set via `next.config.ts`'s `headers()` in both apps (`apps/web`, `apps/admin`) — HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a CSP covering `default-src`/`img-src`/`font-src`/`connect-src`/`frame-ancestors`/`base-uri`/`form-action`/`object-src` are all live. One deliberate gap: `script-src` still includes `'unsafe-inline'` rather than this section's documented nonce approach — this codebase renders several inline `<script>` tags (`ThemeScript` in `packages/ui`, per-page JSON-LD structured data), and a correct nonce implementation needs a per-request nonce generated in middleware and threaded through every one of those call sites. That's a real follow-up, not shipped yet; every other directive is enforced as documented.

### 3.4 CSRF

SameSite=Lax cookies (AUTHENTICATION.md §2.2) mitigate the majority of CSRF risk by default; state-changing REST endpoints (e.g., webhook receivers excluded, since those use signature verification instead) additionally validate request origin.

### 3.5 Rate Limiting & Abuse Prevention

Redis-backed limits on auth, checkout, and public API surfaces (API_SPECIFICATION.md §5) — the first line of defense against credential stuffing, checkout abuse, and scraping.

> **Implementation status (Phase 11):** `packages/api/src/lib/rate-limit.ts` implements this today as an in-memory fixed-window limiter (same "documented deviation" pattern as DATABASE_ARCHITECTURE.md §3.4's cart/session note — Redis/Upstash isn't provisioned in this environment). It's applied to `customerAuth.register`/`login`/`requestPasswordReset`/`resetPassword` (keyed by email, not IP — see the file's own comment for why) and `checkout.createIntent` (keyed by guest email), runtime-verified to correctly return `429 TOO_MANY_REQUESTS` after the configured threshold. It works correctly for a single Node process but does not share state across multiple serverless instances — swap in Upstash's Redis-backed limiter before a multi-instance production deploy.

---

## 4. Data Security

- **Encryption in transit:** TLS 1.2+ enforced everywhere (Vercel-managed certificates); no plaintext HTTP endpoint ever serves real traffic.
- **Encryption at rest:** managed by the Postgres provider (Neon) and Redis provider (Upstash) — full-disk/volume encryption by default; no custom encryption-at-rest implementation to maintain.
- **PII minimization:** we store only what's operationally necessary (name, email, shipping address) — no unnecessary PII fields collected "in case it's useful later."
- **No card data at rest, ever** — reiterated from PAYMENT_ARCHITECTURE.md §1, the single most important data-security decision in the system.
- **Secrets management:** environment variables via Vercel's encrypted secret storage; local development uses `.env.local` (gitignored) seeded from `.env.example`, which documents required variables with no real values (PROJECT_RULES.md §8).
- **Database access:** application connects via a scoped, least-privilege database role; direct production database access is restricted to a small number of engineers, via a bastion/connection-pooler, never a broadly shared credential.

---

## 5. Infrastructure Security

- **Vercel** (hosting) and **Neon** (database) both provide SOC 2 Type II-audited infrastructure — SILONYA inherits their platform-level physical/network security rather than operating our own servers, consistent with the serverless-first stack decision (TECH_STACK.md).
- **Dependency security:** automated scanning (Dependabot/Snyk) in CI (PROJECT_RULES.md §8); critical/high vulnerabilities block merges; dependencies are updated on a regular cadence, not left to drift.
- **CI/CD security:** deploy credentials scoped per environment, stored as encrypted GitHub Actions secrets, never printed to logs; production deploys require the branch protections defined in [PROJECT_RULES.md](./PROJECT_RULES.md) §5 (PR review + passing CI).
- **Third-party script hygiene:** every third-party script (analytics, etc.) is reviewed before inclusion and loaded with the least-privileged strategy available (`next/script`, subresource integrity where applicable) — a compromised third-party script is a realistic supply-chain vector for e-commerce sites specifically (Magecart-style attacks), so this is a standing review item, not a one-time check.

---

## 6. Compliance

- **PCI-DSS:** SAQ A scope via Stripe Elements (PAYMENT_ARCHITECTURE.md §8) — no cardholder data touches SILONYA infrastructure.
- **GDPR / CCPA:** customer data export and deletion endpoints (right to access, right to be forgotten) are required before serving EU/California customers at meaningful volume; soft-delete (`deletedAt`, DATABASE_ARCHITECTURE.md §1) is designed to support a genuine data-purge process for deletion requests, not just hiding records. Consent for marketing communications is explicit opt-in (`User.marketingOptIn`), never pre-checked.
- **Data residency:** not required at MVP (single-region launch); revisited if/when SILONYA operates in jurisdictions with data localization requirements (Phase 4+ international expansion).

---

## 7. Vulnerability Management

- Automated dependency scanning on every PR (§5).
- A lightweight, informal security review accompanies any change touching auth, payments, or admin permissions — not a heavyweight process for every PR, but mandatory for these specific high-risk domains.
- A **formal external security review/penetration test** is a required exit criterion before Phase 2's production go-live (ROADMAP.md) and repeated at a recurring cadence (at minimum annually, or before any major architecture change to auth/payments) thereafter.
- A responsible disclosure channel (e.g., `security@silonya.com` + a `security.txt`) is established before public launch, so external researchers have a defined path to report issues.

---

## 8. Incident Response

Baseline process, to be formalized with specific on-call/escalation details once the team is staffed:

1. **Detect** — Sentry error spikes, Vercel/Upstash anomaly alerts, Stripe Radar fraud flags, or external report.
2. **Contain** — revoke compromised credentials/sessions immediately (AUTHENTICATION.md §2.2 supports mass session revocation), disable the affected endpoint/feature flag if needed.
3. **Assess** — determine scope (what data, how many users, what window of time).
4. **Notify** — affected users and relevant authorities per GDPR/CCPA breach notification requirements if PII was exposed, within the legally required timeframe.
5. **Remediate** — patch the root cause, not just the symptom; add a regression test/monitoring signal that would have caught it.
6. **Post-mortem** — blameless written retrospective, feeding back into this document if it reveals a gap in the threat model.

---

## 9. Security Ownership Across Documents

| Concern                             | Primary document                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Identity, sessions, RBAC            | [AUTHENTICATION.md](./AUTHENTICATION.md)                                        |
| Payment/PCI                         | [PAYMENT_ARCHITECTURE.md](./PAYMENT_ARCHITECTURE.md)                            |
| API-level validation, rate limiting | [API_SPECIFICATION.md](./API_SPECIFICATION.md)                                  |
| Coding-level security rules         | [PROJECT_RULES.md](./PROJECT_RULES.md) §8                                       |
| Infra/CI/CD security                | [DEPLOYMENT.md](./DEPLOYMENT.md)                                                |
| This document                       | Cross-cutting threat model, compliance, incident response — the synthesis layer |

---

## 10. Future Expansion

- **Web Application Firewall (WAF)** — Vercel's built-in DDoS/bot protections cover MVP needs; a dedicated WAF (e.g., Cloudflare) is added if traffic patterns or attack volume justify it.
- **SOC 2 compliance** for SILONYA itself — relevant once the platform handles enterprise partnerships or reaches a scale where customers/partners require it; not a launch requirement.
- **Bug bounty program** — formalizes the responsible disclosure channel (§7) into an incentivized program once the platform has meaningful production traffic worth the investment.
