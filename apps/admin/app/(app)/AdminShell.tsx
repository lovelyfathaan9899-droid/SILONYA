"use client";

import { Button } from "@silonya/ui";
import { Gift, LayoutGrid, ShoppingBag, Shirt, Star, Tag, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutGrid },
  { label: "Orders", href: "/orders", icon: ShoppingBag },
  { label: "Products", href: "/products", icon: Shirt },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Reviews", href: "/reviews", icon: Star },
  { label: "Coupons", href: "/discounts", icon: Tag },
  { label: "Gift cards", href: "/gift-cards", icon: Gift },
] as const;

export interface AdminShellProps {
  children: ReactNode;
  adminEmail: string;
  adminRole: string;
}

/**
 * Sidebar only shows sections that exist (ADMIN_PANEL.md §3 lists a much
 * larger IA — Orders, Customers, Discounts, etc. — those are added here as
 * each module is actually built, not stubbed as dead links ahead of time).
 */
export function AdminShell({ children, adminEmail, adminRole }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="border-mist flex w-60 shrink-0 flex-col border-r bg-white">
        <div className="border-mist border-b px-6 py-5">
          <span className="font-display text-ink text-lg">SILONYA</span>
          <span className="text-stone ml-2 font-sans text-xs uppercase tracking-wide">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
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

        <div className="border-mist border-t px-4 py-4">
          <p className="text-ink truncate font-sans text-sm">{adminEmail}</p>
          <p className="text-stone mb-3 font-sans text-xs uppercase tracking-wide">{adminRole}</p>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="bg-bone flex-1">{children}</main>
    </div>
  );
}
