import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 border px-2.5 py-1 font-sans text-xs uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-mist bg-mist text-ink",
        outline: "border-ink bg-transparent text-ink",
        accent: "border-accent bg-accent text-white",
        success: "border-success bg-success text-white",
        error: "border-error bg-error text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
