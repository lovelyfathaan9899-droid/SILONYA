import { Section, Skeleton } from "@silonya/ui";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";

export default function CategoryLoading() {
  return (
    <Section spacing="lg">
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-11 w-48" />
      </div>
      <ProductGridSkeleton />
    </Section>
  );
}
