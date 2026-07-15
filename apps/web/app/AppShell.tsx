"use client";

import { Footer, Header, ThemeProvider, Toaster } from "@silonya/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderActions } from "@/components/HeaderActions";
import { CustomerSessionProvider } from "@/lib/customer-session-client";
import { footerColumns, footerLegalLinks, footerSocialLinks, primaryNav } from "@/lib/nav-data";

// Passing `Link` (a component reference) as a prop into Header/Footer only
// works when the pass-through itself happens client-side — doing this from
// the (Server Component) root layout trips React Server Components'
// "functions cannot be passed to Client Components" serialization error.
// This wrapper exists purely to keep that prop-passing on the client side of
// the boundary; layout.tsx stays a Server Component so it can still export
// `metadata`.
function Wordmark() {
  return (
    <Link href="/" className="font-display text-ink text-xl tracking-wide">
      SILONYA
    </Link>
  );
}

export function AppShell({ children, loggedIn }: { children: ReactNode; loggedIn: boolean }) {
  return (
    <CustomerSessionProvider loggedIn={loggedIn}>
      <ThemeProvider>
        <Header logo={<Wordmark />} items={primaryNav} actions={<HeaderActions />} linkAs={Link} />
        <main className="flex-1">{children}</main>
        <Footer
          logo={<Wordmark />}
          columns={footerColumns}
          legalLinks={footerLegalLinks}
          socialLinks={footerSocialLinks}
          linkAs={Link}
        />
        <Toaster />
      </ThemeProvider>
    </CustomerSessionProvider>
  );
}
