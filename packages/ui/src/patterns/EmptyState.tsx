import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Nothing-to-show state (empty search results, empty cart, empty order history) — never a bare blank area. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="text-stone mb-1">
          <Icon icon={icon} size={32} />
        </div>
      ) : null}
      <p className="font-display text-ink text-lg">{title}</p>
      {description ? (
        <p className="text-stone max-w-[40ch] font-sans text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
