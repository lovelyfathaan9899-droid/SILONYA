"use client";

import { Button, Icon, MobileDrawer } from "@silonya/ui";
import {
  BarChart3,
  FileDown,
  FileText,
  Gift,
  LayoutGrid,
  Menu,
  Search,
  ShoppingBag,
  Shirt,
  Star,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logoutAction } from "@/app/actions";
import { SessionRefresher } from "@/components/SessionRefresher";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutGrid },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileDown },
  { label: "Orders", href: "/orders", icon: ShoppingBag },
  { label: "Products", href: "/products", icon: Shirt },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Reviews", href: "/reviews", icon: Star },
  { label: "Coupons", href: "/discounts", icon: Tag },
  { label: "Gift cards", href: "/gift-cards", icon: Gift },
  { label: "Content", href: "/content", icon: FileText },
  { label: "Search", href: "/search-analytics", icon: Search },
] as const;

export interface AdminShellProps {
  children: ReactNode;
  adminEmail: string;
  adminRole: string;
}

function NavList({
  pathname,
  onNavigate = () => {
    // no-op default for the desktop sidebar, which doesn't need to close anything
  },
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 py-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2 font-sans text-sm transition-colors duration-150 ${
                  active ? "bg-ink text-white" : "text-ink hover:bg-bone"
                }`}
              >
                <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AccountFooter({ adminEmail, adminRole }: { adminEmail: string; adminRole: string }) {
  return (
    <div className="border-mist border-t px-4 py-4">
      <p className="text-ink truncate font-sans text-sm">{adminEmail}</p>
      <p className="text-stone mb-3 font-sans text-xs uppercase tracking-wide">{adminRole}</p>
      <form action={logoutAction}>
        <Button type="submit" variant="secondary" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}

/**
 * Sidebar only shows sections that exist (ADMIN_PANEL.md §3 lists a much
 * larger IA — Orders, Customers, Discounts, etc. — those are added here as
 * each module is actually built, not stubbed as dead links ahead of time).
 *
 * Below `lg`, the fixed sidebar (found via a mobile audit to be completely
 * unusable on a phone — a static 240px column with no collapse left less
 * than half the viewport for content) becomes a hamburger-triggered
 * MobileDrawer instead, mirroring the storefront's mobile nav pattern.
 */
export function AdminShell({ children, adminEmail, adminRole }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <SessionRefresher />

      <header className="border-mist bg-bone/95 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 pt-[env(safe-area-inset-top)] backdrop-blur-sm lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => {
            setMobileOpen(true);
          }}
          className="text-ink focus-visible:ring-ink -ml-2 flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Icon icon={Menu} size={22} />
        </button>
        <span className="font-display text-ink text-lg tracking-widest">
          SILONYA{" "}
          <span className="text-stone font-sans text-xs uppercase tracking-wide">Admin</span>
        </span>
        <span className="w-11" aria-hidden="true" />
      </header>

      <MobileDrawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Admin menu"
        className="lg:hidden"
      >
        <div className="flex h-full flex-col">
          <NavList
            pathname={pathname}
            onNavigate={() => {
              setMobileOpen(false);
            }}
          />
          <AccountFooter adminEmail={adminEmail} adminRole={adminRole} />
        </div>
      </MobileDrawer>

      <aside className="border-mist hidden bg-white lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r">
        <div className="border-mist border-b px-6 py-5">
          <span className="font-display text-ink text-lg tracking-widest">SILONYA</span>
          <span className="text-stone ml-2 font-sans text-xs uppercase tracking-wide">Admin</span>
        </div>
        <NavList pathname={pathname} />
        <AccountFooter adminEmail={adminEmail} adminRole={adminRole} />
      </aside>

      <main className="bg-bone flex-1">{children}</main>
    </div>
  );
}
