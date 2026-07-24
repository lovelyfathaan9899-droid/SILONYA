import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * DESIGN_SYSTEM.md §2.1 — accent is reserved for the single most important
 * action on screen, so only the "primary" variant uses it on hover, never
 * as a resting fill for every button.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-sans text-sm font-medium transition-colors duration-150 ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-accent",
        secondary: "border border-ink bg-transparent text-ink hover:bg-mist",
        ghost: "bg-transparent text-ink hover:bg-mist",
        link: "bg-transparent text-ink underline-offset-4 hover:underline",
        /** Reserved for irreversible/destructive confirmations (delete, permanent actions) — never used for routine negative actions like "Cancel". */
        destructive: "bg-error text-white hover:bg-error/90",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-13 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";
