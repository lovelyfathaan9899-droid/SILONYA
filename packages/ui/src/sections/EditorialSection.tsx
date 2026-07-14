import Image from "next/image";
import Link from "next/link";
import { Button } from "../primitives/Button";
import { Container } from "../layout/Container";
import { cn } from "../lib/cn";

export interface EditorialSectionProps {
  image: { url: string; altText: string };
  eyebrow?: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  imagePosition?: "left" | "right";
  className?: string;
}

/** Brand storytelling block (SEO_ARCHITECTURE.md §10 — dual-purpose: editorial content and organic acquisition beyond the pure product catalog). */
export function EditorialSection({
  image,
  eyebrow,
  heading,
  body,
  ctaLabel,
  ctaHref,
  imagePosition = "left",
  className,
}: EditorialSectionProps) {
  return (
    <Container className={className}>
      <div className="grid grid-cols-4 items-center gap-6 lg:grid-cols-12 lg:gap-12">
        <div
          className={cn(
            "bg-mist relative col-span-4 aspect-[4/5] w-full overflow-hidden lg:col-span-6",
            imagePosition === "right" && "lg:order-2",
          )}
        >
          <Image
            src={image.url}
            alt={image.altText}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="col-span-4 flex flex-col gap-4 lg:col-span-6">
          {eyebrow ? (
            <p className="text-stone font-sans text-xs uppercase tracking-wide">{eyebrow}</p>
          ) : null}
          <h2 className="font-display text-ink text-3xl md:text-4xl">{heading}</h2>
          <p className="text-stone max-w-[65ch] font-sans text-sm md:text-base">{body}</p>
          {ctaLabel && ctaHref ? (
            <Button asChild variant="secondary" className="mt-2 w-fit">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
