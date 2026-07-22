"use client";

import { Footer, Header, ThemeProvider, Toaster } from "@silonya/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderActions } from "@/components/HeaderActions";
import { SessionRefresher } from "@/components/SessionRefresher";
import { CustomerSessionProvider } from "@/lib/customer-session-client";
import { footerColumns, footerLegalLinks, footerSocialLinks, primaryNav } from "@/lib/nav-data";

export interface FooterSection {
  section: string;
  links: { label: string; href: string }[];
}

// Passing `Link` (a component reference) as a prop into Header/Footer only
// works when the pass-through itself happens client-side — doing this from
// the (Server Component) root layout trips React Server Components'
// "functions cannot be passed to Client Components" serialization error.
// This wrapper exists purely to keep that prop-passing on the client side of
// the boundary; layout.tsx stays a Server Component so it can still export
// `metadata`.
// Tracking widened to ~10% of type size (tracking-widest) rather than the
// prior tracking-wide — a wordmark-only logo (identity strategy: no mascot,
// see the brand identity artifact) relies on open tracking for its presence,
// since there's no accompanying symbol to carry visual weight.
function Wordmark() {
  return (
    <Link href="/" className="font-display text-ink text-xl tracking-widest">
      SILONYA
    </Link>
  );
}

export function AppShell({
  children,
  loggedIn,
  footerSections,
}: {
  children: ReactNode;
  loggedIn: boolean;
  footerSections: FooterSection[];
}) {
  // CMS-driven footer links (ADMIN_PANEL.md §4.6 "Footer management") — the
  // "Legal" section maps to the Footer component's separate legalLinks
  // slot; everything else becomes a regular column. Falls back to the
  // hardcoded nav-data.ts content until the CMS has footer links seeded, so
  // the footer is never empty.
  const legalSection = footerSections.find((s) => s.section.toLowerCase() === "legal");
  const columnSections = footerSections.filter((s) => s.section.toLowerCase() !== "legal");

  const columns =
    columnSections.length > 0
      ? columnSections.map((s) => ({ heading: s.section, links: s.links }))
      : footerColumns;
  const legalLinks = legalSection ? legalSection.links : footerLegalLinks;

  return (
    <CustomerSessionProvider loggedIn={loggedIn}>
      <SessionRefresher />
      <ThemeProvider>
        <Header logo={<Wordmark />} items={primaryNav} actions={<HeaderActions />} linkAs={Link} />
        <main className="flex-1">{children}</main>
        <Footer
          logo={<Wordmark />}
          columns={columns}
          legalLinks={legalLinks}
          socialLinks={footerSocialLinks}
          linkAs={Link}
        />
        <Toaster />
      </ThemeProvider>
    </CustomerSessionProvider>
  );
}
