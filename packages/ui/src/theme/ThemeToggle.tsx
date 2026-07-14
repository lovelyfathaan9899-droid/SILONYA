"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";
import { useTheme } from "./ThemeProvider";
import type { Theme } from "./constants";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
  { value: "system", icon: Monitor, label: "Match system theme" },
];

/** Three-way light/dark/system switch. Renders nothing until mounted client-side to avoid a hydration mismatch against the pre-hydration ThemeScript state. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn("border-mist inline-flex items-center gap-1 border p-1", className)}
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            onClick={() => {
              setTheme(option.value);
            }}
            className={cn(
              "flex h-8 w-8 items-center justify-center transition-colors duration-150",
              "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              selected ? "bg-ink text-white" : "text-stone hover:text-ink",
            )}
          >
            <Icon icon={option.icon} size={16} />
          </button>
        );
      })}
    </div>
  );
}
