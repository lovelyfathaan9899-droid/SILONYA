import { cn } from "../lib/cn";

export interface SpinnerProps {
  size?: number;
  className?: string;
  /** Announced to screen readers — omit only when a visible adjacent label already describes the loading state. */
  label?: string;
}

/** Functional loading indicator — spin is not disabled under reduced motion since it communicates active state, not decoration. */
export function Spinner({ size = 20, className, label = "Loading" }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-spin text-current", className)}
      role="status"
    >
      <title>{label}</title>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
