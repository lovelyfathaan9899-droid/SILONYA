import { Section, Skeleton } from "@silonya/ui";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";

export default function SearchLoading() {
  return (
    <Section spacing="lg">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-6 h-11 w-full max-w-md" />
      <div className="mt-10">
        <ProductGridSkeleton count={4} />
      </div>
    </Section>
  );
}
