import { ThemeScript } from "@silonya/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import { getCustomerContext } from "@/lib/customer-context";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const ctx = await getCustomerContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="bg-bone text-ink flex min-h-screen flex-col">
        <AppShell loggedIn={!!ctx.customerSession}>{children}</AppShell>
      </body>
    </html>
  );
}
