import { ThemeScript } from "@silonya/ui";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
import { toJsonLdString } from "@/lib/json-ld";
import "./globals.css";

const description =
  "SILONYA is a luxury clothing house built on quality cloth and quiet construction — considered pieces, worn for years.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description,
  },
};

// viewportFit: "cover" lets the page draw edge-to-edge under a notch/Dynamic
// Island/home indicator instead of the browser's default letterboxing —
// needed for the sticky header/full-bleed sections to actually reach the
// screen edges. Fixed/sticky elements compensate with explicit
// env(safe-area-inset-*) padding (Header, MobileNav, CartDrawer, Toast)
// rather than relying on the browser to avoid those regions for us.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const ctx = await getCustomerContext();
  const footerSections = await createServerCaller().cms.footer();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdString(organizationJsonLd) }}
        />
      </head>
      <body className="bg-bone text-ink flex min-h-screen flex-col">
        <AppShell loggedIn={!!ctx.customerSession} footerSections={footerSections}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
