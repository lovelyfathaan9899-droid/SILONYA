"use client";

import {
  Badge,
  Button,
  Container,
  EmptyState,
  ErrorState,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@silonya/ui";
import { Star } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type StatusFilter = "pending" | "published" | "rejected" | "all";

export default function ReviewsPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const utils = trpc.useUtils();
  const query = trpc.adminReviews.list.useInfiniteQuery(
    { status, limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const moderate = trpc.adminReviews.moderate.useMutation({
    onSuccess: () => {
      void utils.adminReviews.list.invalidate();
    },
  });

  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Review moderation</h1>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isError ? (
          <ErrorState title="Couldn't load reviews" description={query.error.message} />
        ) : rows.length === 0 && !query.isLoading ? (
          <EmptyState icon={Star} title="No reviews" description="Nothing to moderate right now." />
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((review) => (
              <div key={review.id} className="border-mist border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-ink font-sans text-sm font-medium">
                      {review.product.name} — {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </p>
                    <p className="text-stone font-sans text-xs">
                      {review.user.email} · {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                    {review.title ? (
                      <p className="text-ink mt-2 font-sans text-sm font-medium">{review.title}</p>
                    ) : null}
                    <p className="text-ink mt-1 font-sans text-sm">{review.body}</p>
                  </div>
                  <Badge
                    variant={
                      review.status === "published"
                        ? "success"
                        : review.status === "rejected"
                          ? "error"
                          : "outline"
                    }
                  >
                    {review.status}
                  </Badge>
                </div>
                {review.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={moderate.isPending}
                      onClick={() => {
                        moderate.mutate({ id: review.id, status: "published" });
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={moderate.isPending}
                      onClick={() => {
                        moderate.mutate({ id: review.id, status: "rejected" });
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {query.hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                void query.fetchNextPage();
              }}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
