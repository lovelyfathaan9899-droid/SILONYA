import Image from "next/image";
import Link from "next/link";
import { cn } from "../lib/cn";

export interface CollectionCardProps {
  slug: string;
  name: string;
  image: { url: string; altText: string };
  description?: string;
  className?: string;
  /** Overrides the default `/collections/${slug}` link — used to reuse this same premium card for department/category links. */
  href?: string;
}

export function CollectionCard({
  slug,
  name,
  image,
  description,
  className,
  href,
}: CollectionCardProps) {
  return (
    <Link
      href={href ?? `/collections/${slug}`}
      className={cn("bg-mist group relative flex aspect-[3/4] w-full overflow-hidden", className)}
    >
      <Image
        src={image.url}
        alt={image.altText}
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <div
        aria-hidden="true"
        className="from-ink/50 absolute inset-0 bg-gradient-to-t via-transparent to-transparent"
      />
      <div className="relative z-10 mt-auto flex flex-col gap-1 p-6 text-white">
        <h3 className="font-display text-2xl">{name}</h3>
        {description ? <p className="font-sans text-sm">{description}</p> : null}
      </div>
    </Link>
  );
}
