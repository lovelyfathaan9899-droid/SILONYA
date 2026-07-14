import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";

export interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  // Explicitly `| undefined` — see ToastOptions.description for why.
  description?: string | undefined;
  action?: ReactNode;
  className?: string;
}

/** A failed load/request — distinct from EmptyState (nothing to show) because this communicates something went wrong, not that the result is genuinely empty. */
export function ErrorState({
  icon = AlertTriangle,
  title = "Something went wrong",
  description = "Please try again in a moment.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      <div className="text-error mb-1">
        <Icon icon={icon} size={32} />
      </div>
      <p className="font-display text-ink text-lg">{title}</p>
      <p className="text-stone max-w-[40ch] font-sans text-sm">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
