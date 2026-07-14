# SILONYA — Deployment & Infrastructure

Defines infrastructure topology, environments, CI/CD pipeline, release process, and operational readiness for SILONYA. Builds on the hosting decisions in [TECH_STACK.md](./TECH_STACK.md) §2 and §6.

---

## 1. Infrastructure Topology

```
                              ┌───────────────────────┐
                              │   Cloudflare / Vercel   │
                              │      Edge Network        │
                              └────────────┬─────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                             │                             │
   ┌──────────┴──────────┐       ┌──────────┴──────────┐        ┌────────┴────────┐
   │   apps/web (Vercel)  │       │  apps/admin (Vercel) │        │  Static/media    │
   │   Storefront          │       │  admin.silonya.com    │        │  (Cloudinary CDN) │
   └──────────┬───────────┘       └──────────┬───────────┘        └──────────────────┘
              │                                │
              └────────────────┬───────────────┘
                                │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────┴────────┐ ┌───────┴───────┐ ┌────────┴────────┐
    │ PostgreSQL (Neon)  │ │ Redis (Upstash)│ │ Meilisearch      │
    │ primary + branches  │ │ cache/sessions │ │ (self-hosted)     │
    └────────────────────┘ └───────────────┘ └──────────────────┘
                                │
                     ┌──────────┴──────────┐
                     │   BullMQ workers      │
                     │ (background jobs, on   │
                     │  a small always-on      │
                     │  Node process — Railway/│
                     │  Fly.io, not Vercel     │
                     │  serverless, since queue │
                     │  workers need long-lived  │
                     │  processes)              │
                     └────────────────────────┘
```

**Note on workers:** Vercel's serverless functions are not designed for long-running queue consumers. BullMQ workers (order processing, email sending, search index sync, inventory-reservation sweeps) run on a small persistent Node process on Railway or Fly.io, connected to the same Redis/Postgres — the one deliberate deviation from an all-Vercel topology, and a narrow, well-understood one.

---

## 2. Environments

| Environment  | Purpose                                      | Database                                | Deploy trigger                                      |
| ------------ | -------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `local`      | Developer machines                           | Local Postgres or personal Neon branch  | Manual (`pnpm dev`)                                 |
| `preview`    | Per-PR ephemeral review                      | Fresh Neon branch per PR, auto-migrated | Every pull request opened/updated                   |
| `staging`    | Pre-production QA, mirrors production config | Dedicated `staging` Neon branch         | Merge to `develop`                                  |
| `production` | Live customer-facing site                    | Production Postgres (Neon primary)      | Manual promotion from `main` after staging sign-off |

Every environment uses **Stripe test mode** except production (PAYMENT_ARCHITECTURE.md §8, TESTING_STRATEGY.md §10) — a hard-coded environment check prevents live keys from ever being reachable outside production configuration.

---

## 3. CI/CD Pipeline

GitHub Actions, triggered on every PR and on merge to `develop`/`main`:

```
PR opened/updated
   │
   ├─► Lint + typecheck                                    (parallel)
   ├─► Unit tests                                            (parallel)
   ├─► Integration tests (against ephemeral Neon branch)      (parallel)
   ├─► Build (web + admin)                                    (parallel)
   │
   ▼ (all pass)
Vercel preview deployment (auto)
   │
   ▼
Lighthouse CI + E2E (Playwright) against the preview URL
   │
   ▼ (all pass)
✅ Ready for review → PR review required (PROJECT_RULES.md §5) → merge

Merge to develop  ──► auto-deploy to staging ──► manual QA sign-off
Merge to main (promoted from develop) ──► manual deploy approval ──► production
```

- **No deploy skips the pipeline** — including hotfixes; a production incident is fixed via an expedited PR through the same gates, not a manual out-of-band deploy, because an unverified emergency fix is how incidents become worse.
- Database migrations run as a distinct CI/deploy step **before** the new application code goes live, following the zero-downtime, additive-first migration strategy in [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) §6.

---

## 4. Release Process

1. Feature branches merge to `develop` via reviewed PRs (PROJECT_RULES.md §5).
2. `develop` auto-deploys to `staging`; QA (manual checklist, PROJECT_RULES.md §6) is performed there.
3. Once staging is verified, a release PR/promotion merges `develop` → `main`.
4. Production deploy requires manual approval (a deliberate human checkpoint, not full continuous deployment to production) — appropriate given real customer payments are at stake.
5. Production release is tagged with semantic versioning (`v1.4.0`) once the platform is live (PROJECT_RULES.md §5).
6. Release notes are generated from Conventional Commit history since the last tag.

---

## 5. Rollback Strategy

- **Application code:** rollback = revert the merge commit and redeploy — Vercel's atomic deployments also allow instant rollback to the previous deployment artifact without a rebuild, for the fastest possible recovery from a bad release.
- **Database migrations:** because migrations are additive-first (old code + new schema coexist safely, DATABASE_ARCHITECTURE.md §6), rolling back application code never requires rolling back a migration in the same motion — the two are decoupled by design, which is precisely why the additive-first discipline is mandatory rather than optional.
- **Feature flags** (via PostHog) are used for risky/large features so they can be disabled instantly without a redeploy at all, reserved for genuinely risky launches rather than used as a blanket practice for every change.

---

## 6. Monitoring & Observability

| Signal                 | Tool                                                    | Alert on                                                               |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Application errors     | Sentry                                                  | New error type, error rate spike                                       |
| Web Vitals (real user) | Vercel Speed Insights                                   | Regression beyond PROJECT_RULES.md §7 budgets                          |
| Uptime                 | Vercel + a synthetic uptime check (e.g., Better Uptime) | Any downtime on storefront/checkout                                    |
| Payment failures       | Stripe Dashboard + webhook-driven internal alert        | Abnormal decline rate spike (possible fraud attack or integration bug) |
| Queue health           | BullMQ dashboard (Bull Board)                           | Job failure rate, growing queue backlog                                |
| Database               | Neon metrics                                            | Connection saturation, slow query rate                                 |
| Product analytics      | PostHog                                                 | Conversion funnel drop-offs                                            |

On-call/escalation specifics are formalized once the team is staffed beyond initial launch; the tooling and alert signals above are in place from Phase 2 (MVP) onward regardless of team size, since even a solo/small team needs to know when checkout breaks.

---

## 7. Disaster Recovery

- **Database backups:** Neon's continuous backup/point-in-time-restore capability provides recovery to any point within the retention window — no custom backup scripting to maintain.
- **RPO/RTO targets:** formalized before production go-live (Phase 2 exit criteria); as a baseline, point-in-time restore capability implies an RPO measured in minutes, and restore time (RTO) is validated with an actual test restore before launch, not assumed to work.
- **Multi-region failover:** not implemented at launch (single-region Neon primary) — Vercel's edge network already serves static/cached content globally regardless; full multi-region _database_ failover is deferred until traffic/revenue justifies the added operational complexity (ROADMAP.md Phase 4+ scalability principle).

---

## 8. Infrastructure as Code

- Environment configuration (env vars, build settings) managed through Vercel's project settings, versioned informally via this documentation until team scale justifies full IaC (Terraform) — deliberately not over-engineered for a team of one to a handful of engineers.
- `infra/` directory (TECH_STACK.md §3) is reserved for the point at which IaC becomes worth the overhead — e.g., when the BullMQ worker hosting (§1) or additional services need reproducible provisioning beyond a dashboard click-through.

---

## 9. Cost & Scaling Posture

- Every core service (Vercel, Neon, Upstash, Meilisearch Cloud) scales incrementally with usage rather than requiring large upfront capacity commitments — matches a launching D2C brand's unpredictable early traffic pattern.
- Cost is reviewed as part of the quarterly technical review (PROJECT_RULES.md §6 cadence) alongside performance/accessibility audits — infrastructure choices are revisited if usage patterns make a different provider meaningfully cheaper at the scale actually reached, not preemptively optimized for scale not yet reached.

---

## 10. Future Expansion

- **Multi-region deployment** once international traffic (ROADMAP.md Phase 4) makes single-region latency a measurable conversion problem.
- **Dedicated infra team ownership / Terraform adoption** once manual dashboard configuration becomes an actual bottleneck or audit risk, not before.
- **Blue-green or canary deploys** for production, layered on top of the existing pipeline (§3) once release frequency and risk tolerance make the added complexity worth it over the current revert-and-redeploy rollback model (§5).
