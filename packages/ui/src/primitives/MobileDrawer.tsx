"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";

export interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Generic left-side slide-in panel — the off-canvas navigation pattern
 * shared by the storefront's mobile menu and the admin dashboard's mobile
 * sidebar, factored out here since neither is tied to a specific nav data
 * shape (unlike Header/MobileNav, which are built around the storefront's
 * mega-menu NavItem type).
 */
export function MobileDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/40 fixed inset-0 z-40" />
        <DialogPrimitive.Content
          className={cn(
            "bg-bone fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-xs flex-col shadow-lg",
            "focus-visible:outline-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="border-mist flex h-16 shrink-0 items-center justify-end border-b px-4 pt-[env(safe-area-inset-top)]">
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
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
