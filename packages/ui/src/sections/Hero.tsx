import Image from "next/image";
import Link from "next/link";
import { Button } from "../primitives/Button";
import { cn } from "../lib/cn";

export interface HeroProps {
  image: { url: string; altText: string };
  eyebrow?: string;
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}

/**
 * The single largest LCP element on the homepage (PROJECT_RULES.md §7) —
 * always server-rendered with `priority` so it never depends on
 * client-side JS or a loading spinner to appear.
 */
export function Hero({
  image,
  eyebrow,
  heading,
  subheading,
  ctaLabel,
  ctaHref,
  className,
}: HeroProps) {
  return (
    <div className={cn("relative flex h-[85vh] min-h-[32rem] w-full items-end", className)}>
      <Image
        src={image.url}
        alt={image.altText}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="from-ink/60 via-ink/10 absolute inset-0 bg-gradient-to-t to-transparent"
      />
      <div className="relative z-10 flex flex-col gap-4 px-4 pb-12 text-white sm:px-6 md:px-12 md:pb-16">
        {eyebrow ? <p className="font-sans text-xs uppercase tracking-wide">{eyebrow}</p> : null}
        <h1 className="font-display max-w-2xl text-4xl md:text-6xl">{heading}</h1>
        {subheading ? (
          <p className="max-w-md font-sans text-sm md:text-base">{subheading}</p>
        ) : null}
        {ctaLabel && ctaHref ? (
          <Button asChild size="lg" className="mt-2 w-fit">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
