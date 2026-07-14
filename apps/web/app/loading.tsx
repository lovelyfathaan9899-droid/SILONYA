import { Section, Skeleton } from "@silonya/ui";
import { ProductGridSkeleton } from "@/components/ProductGridSkeleton";

export default function HomeLoading() {
  return (
    <>
      <Skeleton className="h-[85vh] min-h-[32rem] w-full" />

      <Section spacing="lg">
        <Skeleton className="mb-8 h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="aspect-[3/4] w-full" />
        </div>
      </Section>

      <Section spacing="lg" className="bg-mist/40">
        <Skeleton className="mb-8 h-8 w-48" />
        <ProductGridSkeleton count={4} />
      </Section>
    </>
  );
}
