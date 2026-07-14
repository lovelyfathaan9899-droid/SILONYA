import { Section, Skeleton } from "@silonya/ui";

export default function ProductLoading() {
  return (
    <Section spacing="lg">
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-[4/5] w-full" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-13 w-full" />
        </div>
      </div>
    </Section>
  );
}
