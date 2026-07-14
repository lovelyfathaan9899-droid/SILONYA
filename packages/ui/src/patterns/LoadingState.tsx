import { cn } from "../lib/cn";
import { Spinner } from "../primitives/Spinner";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** In-place loading indicator for a section of a page (as opposed to Skeleton, which mimics the eventual content's shape). */
export function LoadingState({ label = "Loading", className }: LoadingStateProps) {
  return (
    <div className={cn("text-stone flex flex-col items-center gap-3 px-6 py-12", className)}>
      <Spinner size={24} label={label} />
      <p className="font-sans text-sm">{label}…</p>
    </div>
  );
}
