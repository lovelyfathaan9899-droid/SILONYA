"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ElementType } from "react";
import { Icon } from "../../icons/Icon";
import { cn } from "../../lib/cn";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../primitives/Accordion";
import { ThemeToggle } from "../../theme/ThemeToggle";
import type { NavItem } from "./types";

export interface MobileNavProps {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkAs?: ElementType;
}

/**
 * Mobile slide-in menu (DESIGN_SYSTEM.md §5 — "navigation collapses to a
 * mobile drawer below `lg`"). Built on the raw Dialog primitive (not the
 * centered <Dialog> in primitives/Dialog.tsx) since a full-height side
 * panel needs different positioning than a centered modal.
 */
export function MobileNav({
  items,
  open,
  onOpenChange,
  linkAs: LinkComponent = "a",
}: MobileNavProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/40 fixed inset-0 z-40 lg:hidden" />
        <DialogPrimitive.Content
          className={cn(
            "bg-bone fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-sm flex-col shadow-lg lg:hidden",
            "focus-visible:outline-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <div className="border-mist flex h-16 items-center justify-end border-b px-4 pt-[env(safe-area-inset-top)]">
            <DialogPrimitive.Close
              aria-label="Close menu"
              className={cn(
                "text-ink flex h-11 w-11 items-center justify-center",
                "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              )}
            >
              <Icon icon={X} size={22} />
            </DialogPrimitive.Close>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-2">
            <Accordion type="multiple">
              {items.map((item) =>
                item.columns ? (
                  <AccordionItem key={item.label} value={item.label}>
                    <AccordionTrigger className="font-display text-base">
                      {item.label}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-4">
                        {item.columns.map((column, columnIndex) => (
                          <div key={column.heading ?? columnIndex} className="flex flex-col gap-2">
                            {column.heading ? (
                              <p className="text-stone font-sans text-xs uppercase tracking-wide">
                                {column.heading}
                              </p>
                            ) : null}
                            {column.links.map((link) => (
                              <LinkComponent
                                key={link.href}
                                href={link.href}
                                className="text-ink font-sans text-sm"
                                onClick={() => {
                                  onOpenChange(false);
                                }}
                              >
                                {link.label}
                              </LinkComponent>
                            ))}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ) : (
                  <div key={item.label} className="border-mist border-b py-4">
                    <LinkComponent
                      href={item.href ?? "#"}
                      className="font-display text-ink text-base"
                      onClick={() => {
                        onOpenChange(false);
                      }}
                    >
                      {item.label}
                    </LinkComponent>
                  </div>
                ),
              )}
            </Accordion>
          </nav>

          {/* Theme switch lives here instead of the header row on mobile —
              see apps/web/components/HeaderActions.tsx for why. */}
          <div className="border-mist flex items-center justify-between border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <span className="text-stone font-sans text-xs uppercase tracking-wide">Theme</span>
            <ThemeToggle />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
