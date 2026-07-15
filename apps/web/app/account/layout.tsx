import { Container, Section } from "@silonya/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCustomerContext } from "@/lib/customer-context";
import { logoutAction } from "../logout/actions";

const NAV_ITEMS = [
  { href: "/account", label: "Overview" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/settings", label: "Settings" },
];

// AUTHENTICATION.md §1 — server-side session validation on every protected
// request, centralized here so individual account pages don't each
// duplicate the redirect check (mirrors apps/admin/app/(app)/layout.tsx).
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const ctx = await getCustomerContext();
  if (!ctx.customerSession) {
    redirect("/login?next=/account");
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[200px_1fr]">
          <nav className="flex flex-row flex-wrap gap-4 md:flex-col md:gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink hover:text-stone font-sans text-sm"
              >
                {item.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button type="submit" className="text-stone hover:text-ink font-sans text-sm">
                Sign out
              </button>
            </form>
          </nav>
          <div>{children}</div>
        </div>
      </Container>
    </Section>
  );
}
