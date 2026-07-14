"use client";

import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { ChevronDown } from "lucide-react";
import type { ElementType } from "react";
import { Icon } from "../../icons/Icon";
import { cn } from "../../lib/cn";
import type { NavItem } from "./types";

export interface DesktopNavProps {
  items: NavItem[];
  /** Link component to render hrefs with (e.g. next/link's `Link`). Defaults to a plain anchor. */
  linkAs?: ElementType;
}

/**
 * Desktop mega menu (DESIGN_SYSTEM.md §5 — "mega-menu is desktop-only").
 * Built on Radix NavigationMenu for correct roving-tabindex keyboard
 * navigation and ARIA menu semantics out of the box.
 */
export function DesktopNav({ items, linkAs: LinkComponent = "a" }: DesktopNavProps) {
  return (
    <NavigationMenu.Root className="relative" delayDuration={100}>
      <NavigationMenu.List className="flex items-center gap-8">
        {items.map((item) => (
          <NavigationMenu.Item key={item.label}>
            {item.columns ? (
              <>
                <NavigationMenu.Trigger
                  className={cn(
                    "text-ink group flex items-center gap-1 py-2 font-sans text-sm",
                    "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  )}
                >
                  {item.label}
                  <Icon
                    icon={ChevronDown}
                    size={14}
                    className="transition-transform duration-200 group-data-[state=open]:rotate-180"
                  />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="border-mist absolute left-0 top-full w-full border-b bg-white shadow-md">
                  <div className="mx-auto grid max-w-[90rem] grid-cols-4 gap-8 px-4 py-8">
                    {item.columns.map((column, columnIndex) => (
                      <div key={column.heading ?? columnIndex} className="flex flex-col gap-3">
                        {column.heading ? (
                          <p className="text-stone font-sans text-xs uppercase tracking-wide">
                            {column.heading}
                          </p>
                        ) : null}
                        <ul className="flex flex-col gap-2">
                          {column.links.map((link) => (
                            <li key={link.href}>
                              <NavigationMenu.Link asChild>
                                <LinkComponent
                                  href={link.href}
                                  className="text-ink hover:text-accent font-sans text-sm transition-colors duration-150"
                                >
                                  {link.label}
                                </LinkComponent>
                              </NavigationMenu.Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </NavigationMenu.Content>
              </>
            ) : (
              <NavigationMenu.Link asChild>
                <LinkComponent
                  href={item.href ?? "#"}
                  className={cn(
                    "text-ink block py-2 font-sans text-sm",
                    "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  )}
                >
                  {item.label}
                </LinkComponent>
              </NavigationMenu.Link>
            )}
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
