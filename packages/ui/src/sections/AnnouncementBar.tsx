"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

export interface AnnouncementBarProps {
  message: string;
  /** Distinguishes one announcement from the next so dismissing today's message doesn't also hide tomorrow's. */
  dismissKey?: string;
  className?: string;
}

const STORAGE_PREFIX = "silonya:announcement-dismissed:";

/**
 * Persistent site-wide strip rendered in AppShell above the header (distinct
 * from PromoBanner, which is homepage-only) — e.g. "Free shipping over PKR
 * 5,000 | Cash on Delivery available nationwide". Dismissal is per-browser
 * via localStorage, keyed by message so editing the announcement in the
 * admin panel automatically re-shows it to visitors who dismissed the old
 * one.
 */
export function AnnouncementBar({ message, dismissKey, className }: AnnouncementBarProps) {
  const storageKey = `${STORAGE_PREFIX}${dismissKey ?? message}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className={cn("bg-ink relative flex items-center justify-center px-10 py-2", className)}>
      <p className="text-center font-sans text-xs text-white sm:text-sm">{message}</p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          window.localStorage.setItem(storageKey, "1");
          setDismissed(true);
        }}
        className="focus-visible:ring-offset-ink absolute right-3 top-1/2 -translate-y-1/2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
      >
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
