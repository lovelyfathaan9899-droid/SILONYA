"use client";

import { Badge, Button, Container, Section, toast } from "@silonya/ui";
import { trpc } from "@/lib/trpc";

export default function SearchAnalyticsPage() {
  const status = trpc.adminSearch.status.useQuery();
  const popular = trpc.adminSearch.popularQueries.useQuery({});
  const zeroResult = trpc.adminSearch.zeroResultQueries.useQuery({});
  const reindex = trpc.adminSearch.reindexAll.useMutation({
    onSuccess: (result) => {
      toast({ title: `Reindexed ${String(result.documentsIndexed)} documents` });
    },
    onError: (err) => {
      toast({ title: "Reindex failed", description: err.message, variant: "error" });
    },
  });

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-ink text-2xl">Search</h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={status.data?.configured ? "success" : "default"}>
                {status.data?.configured ? "Meilisearch connected" : "Meilisearch not configured"}
              </Badge>
            </div>
          </div>
          <Button
            disabled={!status.data?.configured || reindex.isPending}
            onClick={() => {
              reindex.mutate();
            }}
          >
            {reindex.isPending ? "Reindexing…" : "Reindex all products"}
          </Button>
        </div>
        {!status.data?.configured ? (
          <p className="text-stone mb-8 font-sans text-sm">
            Search currently falls back to Postgres text search. Set <code>MEILISEARCH_HOST</code>{" "}
            and <code>MEILISEARCH_API_KEY</code> to enable full-text search, facets, and typo
            tolerance.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-ink mb-3 text-lg">Popular searches (30 days)</h2>
            {popular.data?.length === 0 ? (
              <p className="text-stone font-sans text-sm">No searches logged yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {popular.data?.map((row) => (
                  <li key={row.query} className="text-ink flex justify-between font-sans text-sm">
                    <span>{row.query}</span>
                    <span className="text-stone">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-display text-ink mb-3 text-lg">Zero-result searches (30 days)</h2>
            {zeroResult.data?.length === 0 ? (
              <p className="text-stone font-sans text-sm">None — good sign.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {zeroResult.data?.map((row) => (
                  <li key={row.query} className="text-ink flex justify-between font-sans text-sm">
                    <span>{row.query}</span>
                    <span className="text-stone">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
