"use client";

import { Menu } from "lucide-react";
import { useState, type ElementType, type ReactNode } from "react";
import { Icon } from "../../icons/Icon";
import { Container } from "../../layout/Container";
import { cn } from "../../lib/cn";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import type { NavItem } from "./types";

export interface HeaderProps {
  /** Brand mark — a wordmark or logo image, supplied by the app so packages/ui has no brand-asset dependency. */
  logo: ReactNode;
  items: NavItem[];
  /** Right-side slot (search/account/cart/theme toggle icons) — deliberately not hardcoded here so this stays a pure layout Section (TECH_STACK.md §3, DESIGN_SYSTEM.md §3). */
  actions?: ReactNode;
  linkAs?: ElementType;
  className?: string;
}

/**
 * Sticky, responsive site header — desktop mega menu above `lg`
 * (DESIGN_SYSTEM.md §5), mobile slide-in drawer below it. Content (logo,
 * nav items, right-side actions) is fully prop-driven; this component only
 * owns layout/interaction, never brand copy or real catalog data.
 */
export function Header({ logo, items, actions, linkAs = "a", className }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "border-mist bg-bone/95 sticky top-0 z-30 border-b backdrop-blur-sm",
        className,
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between md:h-20">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => {
              setMobileOpen(true);
            }}
            className={cn(
              "text-ink -ml-2 flex h-11 w-11 items-center justify-center lg:hidden",
              "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            )}
          >
            <Icon icon={Menu} size={22} />
          </button>

          <div className="flex flex-1 justify-center lg:flex-none lg:justify-start">{logo}</div>

          <div className="hidden flex-1 justify-center lg:flex">
            <DesktopNav items={items} linkAs={linkAs} />
          </div>

          <div className="flex items-center justify-end gap-1 lg:flex-1">{actions}</div>
        </div>
      </Container>

      <MobileNav items={items} open={mobileOpen} onOpenChange={setMobileOpen} linkAs={linkAs} />
    </header>
  );
}
