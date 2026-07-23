import { ThemeProvider, ThemeScript, Toaster } from "@silonya/ui";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SILONYA Admin",
  description: "SILONYA internal admin dashboard.",
  robots: { index: false, follow: false },
};

// See apps/web/app/layout.tsx for why viewport-fit=cover plus explicit
// safe-area padding on fixed elements, rather than relying on the browser
// default.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="bg-bone text-ink">
        <ThemeProvider>
          <Providers>{children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
