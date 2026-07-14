# SILONYA — Design System

This document defines SILONYA's visual identity and the UX principles, responsive rules, and accessibility standards that govern every screen we build. It is binding for all UI work — see [PROJECT_RULES.md](./PROJECT_RULES.md) for how it's enforced in code.

---

## 1. Design Philosophy

**"Confident restraint."**

SILONYA's interface should feel like a well-edited garment: nothing is there that doesn't need to be. Every screen earns its whitespace. The product photography and the copy carry the brand — the UI's job is to get out of the way and never introduce friction, delay, or visual noise.

Three governing principles:

1. **Clarity over decoration.** If a visual flourish doesn't aid comprehension or reinforce brand feeling, cut it.
2. **Speed is a design feature.** A beautiful screen that loads slowly is a broken screen. Performance budgets (see §7) are part of the design spec, not an engineering afterthought.
3. **Consistency compounds.** A shopper should never have to relearn an interaction pattern between the homepage, PLP, PDP, and checkout.

---

## 2. Brand Identity

### 2.1 Color System

A restrained, near-monochrome palette with a single signature accent — colors are used to guide attention, not decorate.

| Token             | Value                        | Usage                                                             |
| ----------------- | ---------------------------- | ----------------------------------------------------------------- |
| `--color-ink`     | `#111111`                    | Primary text, primary buttons                                     |
| `--color-bone`    | `#F5F3EF`                    | Primary background (warm off-white, not clinical white)           |
| `--color-white`   | `#FFFFFF`                    | Cards, elevated surfaces                                          |
| `--color-stone`   | `#8A8681`                    | Secondary text, borders, muted UI                                 |
| `--color-mist`    | `#E7E4DE`                    | Dividers, disabled states, subtle fills                           |
| `--color-accent`  | `#A8552F` (burnt terracotta) | CTAs on hover, sale/badges, editorial highlights — used sparingly |
| `--color-error`   | `#B3261E`                    | Form errors, destructive actions                                  |
| `--color-success` | `#2E5339`                    | Order confirmation, in-stock indicators                           |

**Rule:** `--color-accent` should never exceed ~5% of any given viewport. It marks the single most important action or piece of information on screen, not a decorative theme color.

**Dark mode:** the original plan deferred dark mode past MVP (fashion imagery is color-critical and a full dark theme needs separate art direction). The _architecture_ was brought forward in Phase 3 at explicit request — `packages/ui/src/theme` (ThemeProvider, system-preference detection, persisted user choice, no-flash inline script) plus a dark token set in `packages/config/tailwind/tokens.css`. Every component reads semantic tokens (`bg-bone`, `text-ink`, etc.), never literal colors, so the dark values apply everywhere automatically. The specific dark palette is a reasonable, contrast-checked default, not final art direction — swappable in one file without touching component code, same as the placeholder typefaces below.

### 2.2 Typography

| Role                | Typeface                                                                                                       | Notes                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Display / Editorial | **A high-contrast serif** (e.g., "Canela," "GT Sectra," or a licensed equivalent — final selection in Phase 1) | Hero headlines, collection titles, editorial storytelling      |
| UI / Body           | **A clean grotesque sans-serif** (e.g., "Inter" or "Suisse Int'l")                                             | Navigation, body copy, product info, forms, all interface text |

- Type scale follows a modular scale (1.25 ratio), tokenized as `--text-xs` through `--text-6xl` in the shared Tailwind config.
- Line length for body copy is capped (~65–75ch) for readability.
- All caps is used only for micro-labels (nav items, tags) at reduced tracking-widened sizing — never for body copy or headlines.

### 2.3 Spacing & Grid

- 8px base spacing unit; all spacing tokens are multiples of it (`--space-1` = 8px … `--space-12` = 96px).
- 12-column grid on desktop (≥1024px), 4-column on mobile (<640px), with generous gutters (24px mobile, 32px+ desktop).
- Generous negative space is a brand signature — components default to more breathing room, not less.

### 2.4 Imagery

- Editorial, art-directed photography only — no generic stock imagery.
- Product photography: consistent lighting, consistent background (bone/white), consistent crop ratios per product type.
- All images shipped as responsive, optimized AVIF/WebP via Cloudinary (see TECH_STACK.md).

### 2.5 Iconography & Motion

- Icons: single-weight line icons (Lucide as base set, customized), never mixed styles.
- Motion: purposeful only — page transitions, hover states, add-to-cart confirmation. Duration 150–300ms, ease-out. No decorative animation that delays user action (e.g., no animated preloaders longer than necessary).

---

## 3. Component Architecture

Built on **shadcn/ui + Radix primitives**, fully re-themed to SILONYA tokens — never used with default styling. Components live in `packages/ui` and follow atomic-inspired tiers:

| Tier           | Examples                                                 | Rule                                                                                                                         |
| -------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Primitives** | Button, Input, Checkbox, Select, Dialog                  | Wrap Radix; own all styling via design tokens; zero business logic                                                           |
| **Patterns**   | ProductCard, SizeSelector, PriceDisplay, AddressForm     | Compose primitives; may contain light presentational logic; no data fetching                                                 |
| **Sections**   | ProductGrid, Header, Footer, CartDrawer, CheckoutSummary | Compose patterns; may connect to data via hooks/props; app-specific sections live in the app, reusable ones in `packages/ui` |
| **Templates**  | PDP layout, PLP layout, Checkout flow layout             | Full-page compositions living in `apps/web/app`                                                                              |

**Rules:**

- Every primitive must be accessible (keyboard, screen reader, focus-visible) before it's considered done — not retrofitted later.
- No component reaches into global state or fetches data directly except at the Section tier or above.
- Every new pattern-tier-or-above component gets a visual reference (Figma or Storybook) before being built. Since a dedicated Storybook instance isn't in TECH_STACK.md's tooling, `apps/web/app/style-guide` (noindex, internal-only) serves this purpose as a living reference showing every component in one place — kept in sync as components are added, not a one-time snapshot.

**Cross-cutting systems** (not components themselves, but what every component builds on — also in `packages/ui`):

| System            | Location                 | Purpose                                                                                                                |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Layout primitives | `packages/ui/src/layout` | `Container` (max-width + gutters), `Section` (vertical rhythm + tone), `Grid` (§2.3's 4/12-col system)                 |
| Theme             | `packages/ui/src/theme`  | `ThemeProvider`/`useTheme`, `ThemeScript` (no-flash init), `ThemeToggle` — see dark mode note in §2.1                  |
| Motion            | `packages/ui/src/motion` | Shared Framer Motion variants + `Reveal` (scroll-in), all honoring §2.5's duration/easing and `prefers-reduced-motion` |
| Icons             | `packages/ui/src/icons`  | `Icon` — single point of control for icon size/stroke-width so every icon in the app looks consistent                  |

---

## 4. UI/UX Principles

1. **Frictionless discovery.** Filtering, sorting, and search must never trigger a full page reload; state is preserved in the URL for shareability and back-button correctness.
2. **Trust signals throughout.** Clear shipping/returns info, security badges at checkout, real inventory counts — never fake urgency ("Only 2 left!" only shown if literally true).
3. **Guest checkout is the default path.** Account creation is offered, never required, to complete a purchase.
4. **One primary action per screen.** Every screen has one obvious next step, visually dominant; secondary actions are visually subordinate.
5. **Progressive disclosure.** Product detail, size guides, and shipping info are available but not forced on the shopper up front — expandable, not pre-expanded.
6. **Cart and checkout are sacred.** No layout shifts, no new components introduced in checkout that weren't already established elsewhere in the app. This is the highest-stakes, lowest-tolerance-for-friction part of the site.

---

## 5. Responsive Design Rules

Mobile-first. Every component is designed and built for the smallest breakpoint first, then enhanced upward.

| Breakpoint | Width    | Primary use                     |
| ---------- | -------- | ------------------------------- |
| `sm`       | ≥ 640px  | Large phones, landscape         |
| `md`       | ≥ 768px  | Tablets                         |
| `lg`       | ≥ 1024px | Small laptops                   |
| `xl`       | ≥ 1280px | Desktops                        |
| `2xl`      | ≥ 1536px | Large/editorial desktop layouts |

**Rules:**

- Touch targets ≥ 44×44px on all interactive elements at mobile widths.
- No horizontal scroll at any breakpoint except intentional carousels (which must have visible affordance they're scrollable).
- Navigation collapses to a mobile drawer below `lg`; mega-menu is desktop-only.
- Checkout is single-column on mobile, two-column (form + order summary) from `lg` up.
- Images use `next/image` with defined `sizes` for every breakpoint — never a single fixed size served to all devices.

---

## 6. Accessibility Rules

Target: **WCAG 2.1 Level AA**, minimum, across the entire storefront and checkout.

- **Color contrast:** minimum 4.5:1 for body text, 3:1 for large text (≥24px) and UI components/icons.
- **Keyboard navigation:** every interactive element reachable and operable via keyboard alone, with a visible focus state (never `outline: none` without a replacement).
- **Screen readers:** semantic HTML first (`<button>`, `<nav>`, `<main>`, `<form>`); ARIA only to fill genuine gaps, never as a substitute for semantic markup.
- **Images:** meaningful `alt` text on all product and editorial imagery; decorative images marked `alt=""`.
- **Forms:** every input has a programmatically associated `<label>`; errors are announced (`aria-live`) and described in text, not color alone.
- **Motion:** respect `prefers-reduced-motion` — all non-essential animation disabled for users who request it.
- **Testing:** automated accessibility checks (axe) run in CI on every PR; manual screen-reader pass (VoiceOver/NVDA) required before major flows (checkout, account) ship.

Accessibility is a release blocker, not a follow-up ticket — see [PROJECT_RULES.md](./PROJECT_RULES.md) §Quality Assurance.

---

## 7. Performance as Design Constraint

These budgets are treated as design requirements, not just engineering targets (full detail in PROJECT_RULES.md §Performance Standards):

- Largest Contentful Paint (LCP) < 2.5s on 4G/mid-tier mobile
- Cumulative Layout Shift (CLS) < 0.1 — no unstyled content flashes, no image-load jank
- Hero imagery and above-the-fold content must never depend on client-side JS to render

Any design decision (auto-playing video hero, heavy carousel, large unoptimized imagery) is evaluated against these budgets before approval.

---

## 8. Living Document

Concrete brand assets (exact typeface licenses, logo files, full color/typography specimen, Figma component library) will be produced and linked here during Phase 1 of the [ROADMAP](./ROADMAP.md). This document defines the _system_ the assets must conform to.
