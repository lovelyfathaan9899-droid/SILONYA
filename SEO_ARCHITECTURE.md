# SILONYA — SEO Architecture

Technical and content SEO strategy for SILONYA. Organic search is a primary acquisition channel for a D2C fashion brand (README.md §4 business goals) — this document is treated with the same rigor as performance or security, not as an afterthought layered on at the end.

---

## 1. Principles

1. **SEO is architecture, not a checklist bolted on later.** Rendering strategy, URL structure, and data modeling decisions made in Phase 1 (TECH_STACK.md, DATABASE_ARCHITECTURE.md) are chosen with SEO consequences considered up front.
2. **Every indexable page is server-rendered.** No critical content (product name, price, description) ever depends on client-side JS execution to appear in the initial HTML — required both for crawlers and for Core Web Vitals (PROJECT_RULES.md §7).
3. **Uniqueness over templating.** Titles, descriptions, and content are unique per page — never a mechanically templated string that produces near-duplicate content across hundreds of PDPs.

---

## 2. Rendering Strategy

| Page type                  | Strategy                                                                                                                     | Why                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Homepage, Collection pages | SSG + ISR (revalidate on publish)                                                                                            | High-value, relatively stable, needs to be fast and fully crawlable                                             |
| Product Detail Pages (PDP) | SSG + ISR (revalidate on-demand when admin updates product)                                                                  | Highest SEO value pages on the site; must be instant and always current                                         |
| Category/PLP with filters  | SSR for the base (unfiltered) view; filtered states are client-navigated but the base category URL is always fully crawlable | Balances crawlability of the canonical category page with fast interactive filtering (SEARCH_AND_FILTERS.md §5) |
| Cart, checkout, account    | CSR-acceptable (behind `noindex`)                                                                                            | Not indexable content, no SEO value, prioritize interactivity                                                   |
| Editorial/content pages    | SSG                                                                                                                          | Long-lived content, ideal for static generation                                                                 |

On-demand ISR revalidation (`revalidatePath`) is triggered directly from the admin publish action (ADMIN_PANEL.md §4.3) — the gap between "product updated" and "search engines/social shares see current data" is seconds, not the default ISR interval.

---

## 3. Structured Data (JSON-LD)

| Page                 | Schema.org type                               | Key fields                                                                                                           |
| -------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| PDP                  | `Product`                                     | name, description, image, sku, offers (price, currency, availability), aggregateRating (once reviews exist, Phase 3) |
| PDP/PLP              | `BreadcrumbList`                              | full category hierarchy path                                                                                         |
| Homepage             | `Organization`                                | name, logo, sameAs (social profiles), contactPoint                                                                   |
| Collection/editorial | `CollectionPage` / `Article` where applicable |                                                                                                                      |

Structured data is generated server-side from the same data contract that renders the visible page (PRODUCT_SYSTEM.md §6) — never maintained as a separate, driftable source, so the JSON-LD can never disagree with what the customer actually sees (a Google Search Console penalty risk if it does).

---

## 4. URL Structure

```
/                                    homepage
/products/{slug}                     PDP
/collections/{slug}                  Collection/PLP
/categories/{category-path}          Category browsing
/search?q={query}                    Search results (noindex — dynamic query pages provide little unique SEO value)
/account/*, /cart, /checkout          noindex, nofollow
/order/confirmation, /orders/track    noindex, nofollow — order/address detail behind a signed access token
```

- Slugs are human-readable, kebab-case, generated from product/collection names at creation time and **immutable once published** — changing a live product's slug breaks inbound links and search rankings, so slug edits after publish require an explicit redirect to be created (§6).
- No trailing slashes, no case variation, no query-parameter duplication of canonical content (`?ref=`, `?utm_=` params are stripped by canonical tag, §5).

---

## 5. Metadata & Canonicalization

- Every page defines a unique `<title>` and `meta description` — for PDPs, sourced from `Product.seoTitle`/`seoDescription` if set by merchandising, falling back to a generated-but-still-unique default (product name + key attribute + brand), never a bare repeated template.
- `<link rel="canonical">` set on every page, pointing to the clean canonical URL — strips tracking/filter query params so paginated/filtered/UTM-tagged variants of a page consolidate SEO value to one canonical URL instead of fragmenting it.
- Open Graph and Twitter Card metadata on every indexable page (image, title, description) for correct social share previews — a direct extension of the same content model, not a separate maintenance burden.

---

## 6. Redirects & URL Lifecycle

- A `Redirect` table (source path → destination path, 301) is maintained for any URL that changes post-launch (slug edits, retired collections, category restructuring) — enforced at the edge/middleware layer so no previously-indexed URL ever 404s silently.
- Archiving a product (PRODUCT_SYSTEM.md §2) does not delete its URL outright — the PDP renders a clear "no longer available" state with links to related/current products (preserves some link equity and avoids a jarring 404 for a page that may still have inbound links), rather than an immediate hard 404 or redirect to an unrelated page.

---

## 7. Sitemaps & Crawl Control

- `sitemap.xml` (API_SPECIFICATION.md §3) dynamically generated from the live catalog (published products, collections, categories, editorial pages) — regenerated on content changes, not a stale static file.
- `robots.txt` disallows `/cart`, `/checkout`, `/account`, `/search` — keeps crawl budget focused on indexable, valuable pages.
- Large catalogs (Phase 4+) use sitemap index files (split by type/date) rather than one monolithic file, per search engine best practice at scale.

---

## 8. International SEO (Phase 4)

- `hreflang` tags across language/region variants once multi-language launches (ROADMAP.md Phase 4), pointing every regional variant of a page at every other — preventing duplicate-content penalties across markets.
- Region-specific subpaths (`/en-us/`, `/en-gb/`, `/fr-fr/`) rather than separate ccTLDs or subdomains, to consolidate domain authority under a single root domain during the brand-building phase.

---

## 9. Performance as an SEO Factor

Core Web Vitals are a direct ranking signal — the budgets defined in [PROJECT_RULES.md](./PROJECT_RULES.md) §7 (LCP < 2.5s, CLS < 0.1, INP < 200ms) are SEO requirements as much as UX requirements, and are monitored via the same Lighthouse CI gate on every PR.

---

## 10. Content Strategy

- **Product copy** is written for humans first, but structured to naturally surface the terms customers actually search (material, fit, occasion) rather than keyword-stuffed — matches DESIGN_SYSTEM.md's editorial, non-shouty brand voice.
- **Editorial/lookbook content** (Phase 3, ADMIN_PANEL.md §4.6) serves a dual purpose: brand storytelling and top-of-funnel organic acquisition (style guides, seasonal content) that a pure product catalog can't capture on its own.
- **Internal linking**: PDPs link to their category and relevant collections; collection pages link back to key products — reinforces topical relevance and crawl depth without a separate "SEO linking" initiative bolted on top.

---

## 11. Monitoring

- Google Search Console (indexing status, coverage errors, Core Web Vitals field data) reviewed on a recurring cadence as part of the quarterly audit process defined in [PROJECT_RULES.md](./PROJECT_RULES.md) §6.
- 404/redirect monitoring via server logs — a spike in 404s on previously-valid URLs is treated as a bug (missing redirect, §6), not noise.

---

## 12. Future Expansion

- **Structured FAQ/How-to content** for size guides and care instructions — additional schema.org types layered on once that content exists (Phase 3+).
- **Programmatic SEO** (e.g., auto-generated "Best [category] for [occasion]" pages) is explicitly deferred — high risk of thin/duplicate content for a premium brand if done without genuine editorial quality behind it; revisit only with dedicated content investment.
