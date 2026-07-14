import Image from "next/image";
import Link from "next/link";
import { cn } from "../lib/cn";
import { PriceDisplay } from "./PriceDisplay";
import { WishlistButton } from "./WishlistButton";

export interface ProductCardProps {
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  image: { url: string; altText: string } | null;
  available?: boolean;
  isWishlisted?: boolean;
  onWishlistToggle?: () => void;
  className?: string;
}

/**
 * Uses next/link and next/image directly rather than the `linkAs` prop
 * pattern the Phase 3 sections (Header/Footer/Breadcrumbs) use — those
 * predate the decision that packages/ui can depend on Next.js directly
 * (this monorepo has no non-Next.js consumer, so the abstraction wasn't
 * earning its cost here; see packages/ui/package.json's next dependency).
 */
export function ProductCard({
  slug,
  name,
  price,
  compareAtPrice,
  currency = "USD",
  image,
  available = true,
  isWishlisted = false,
  onWishlistToggle,
  className,
}: ProductCardProps) {
  return (
    <div className={cn("group relative flex flex-col gap-3", className)}>
      <div className="bg-mist relative aspect-[4/5] w-full overflow-hidden">
        <Link href={`/products/${slug}`} className="block h-full w-full">
          {image ? (
            <Image
              src={image.url}
              alt={image.altText}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className={cn(
                "object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                !available && "opacity-60",
              )}
            />
          ) : null}
        </Link>
        {!available ? (
          <span className="text-stone absolute left-3 top-3 bg-white px-2 py-1 font-sans text-xs uppercase tracking-wide">
            Sold out
          </span>
        ) : null}
        {onWishlistToggle ? (
          <WishlistButton
            active={isWishlisted}
            onToggle={onWishlistToggle}
            className="absolute right-3 top-3 border-none bg-white/90 backdrop-blur-sm hover:bg-white"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Link href={`/products/${slug}`} className="text-ink font-sans text-sm hover:underline">
          {name}
        </Link>
        <PriceDisplay
          price={price}
          currency={currency}
          className="text-sm"
          {...(compareAtPrice !== undefined ? { compareAtPrice } : {})}
        />
      </div>
    </div>
  );
}
