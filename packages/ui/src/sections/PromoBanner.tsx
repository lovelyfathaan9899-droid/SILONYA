import Link from "next/link";
import { cn } from "../lib/cn";

export interface PromoBannerProps {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  tone?: "ink" | "bone" | "accent";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<PromoBannerProps["tone"]>, string> = {
  ink: "bg-ink text-white",
  bone: "bg-bone text-ink",
  accent: "bg-accent text-white",
};

/** The slim announcement strip variant (e.g. "Free shipping over $200") — see EditorialSection for a larger promotional block with imagery. */
export function PromoBanner({
  message,
  ctaLabel,
  ctaHref,
  tone = "ink",
  className,
}: PromoBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 px-4 py-3",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <p className="font-sans text-sm">{message}</p>
      {ctaLabel && ctaHref ? (
        <Link href={ctaHref} className="font-sans text-sm underline underline-offset-4">
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
