import { Grid, Skeleton } from "@silonya/ui";

/** Mirrors ProductGrid's exact layout (2-up mobile, 4-up desktop) so the loading state never causes layout shift once real content lands. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Grid>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="col-span-2 flex flex-col gap-3 lg:col-span-3">
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </Grid>
  );
}
