import type { LucideIcon } from "lucide-react";

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  /** Decorative by default (aria-hidden) — pass a label when the icon is the only content of an interactive element. */
  label?: string;
}

/**
 * Single point of control for icon presentation (DESIGN_SYSTEM.md §2.5 —
 * "single-weight line icons... never mixed styles"). Every icon in the app
 * renders through this component rather than importing lucide-react icons
 * directly, so the stroke width and default size can change once, here.
 */
export function Icon({ icon: LucideIconComponent, size = 20, className, label }: IconProps) {
  return (
    <LucideIconComponent
      size={size}
      strokeWidth={1.5}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
