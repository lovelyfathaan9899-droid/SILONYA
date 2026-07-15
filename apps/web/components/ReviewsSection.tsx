"use client";

import type { AppRouter } from "@silonya/api";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@silonya/ui";
import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { useEffect, useState, type SyntheticEvent } from "react";
import { useIsLoggedIn } from "@/lib/customer-session-client";
import { trpcClient } from "@/lib/trpc-client";

type ReviewList = inferRouterOutputs<AppRouter>["reviews"]["listForProduct"];

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${String(rating)} out of 5 stars`} className="text-ink font-sans text-sm">
      {"★".repeat(Math.round(rating))}
      {"☆".repeat(5 - Math.round(rating))}
    </span>
  );
}

function WriteReviewForm({
  productId,
  onSubmitted,
}: {
  productId: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await trpcClient.reviews.create.mutate({
        productId,
        rating,
        body: body.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      });
      toast({ title: "Review submitted", description: "It'll appear once it's been moderated." });
      setTitle("");
      setBody("");
      onSubmitted();
    } catch (err) {
      toast({
        title: "Couldn't submit review",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex max-w-md flex-col gap-3">
      <Label htmlFor="review-rating">Rating</Label>
      <Select
        value={String(rating)}
        onValueChange={(value) => {
          setRating(Number(value));
        }}
      >
        <SelectTrigger id="review-rating" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[5, 4, 3, 2, 1].map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} star{n === 1 ? "" : "s"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="review-title">Title (optional)</Label>
      <Input
        id="review-title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
      />
      <Label htmlFor="review-body">Review</Label>
      <Textarea
        id="review-body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        placeholder="Share your thoughts…"
        required
        rows={4}
      />
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const loggedIn = useIsLoggedIn();
  const [data, setData] = useState<ReviewList | null>(null);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    trpcClient.reviews.listForProduct
      .query({ productId })
      .then(setData)
      .catch(() => {
        setData({ items: [], averageRating: 0, count: 0 });
      });
  }, [productId]);

  useEffect(() => {
    if (!loggedIn) return;
    trpcClient.reviews.eligibility
      .query({ productId })
      .then((result) => {
        setEligible(result.canReview);
      })
      .catch(() => {
        setEligible(false);
      });
  }, [loggedIn, productId]);

  function refresh() {
    trpcClient.reviews.listForProduct
      .query({ productId })
      .then(setData)
      .catch(() => undefined);
    setEligible(false);
  }

  return (
    <div className="mt-20 max-w-3xl">
      <h2 className="font-display text-ink mb-4 text-xl">Reviews</h2>
      {data && data.count > 0 ? (
        <p className="text-stone mb-8 font-sans text-sm">
          <Stars rating={data.averageRating} /> {data.averageRating.toFixed(1)} out of 5 (
          {data.count} review{data.count === 1 ? "" : "s"})
        </p>
      ) : (
        <p className="text-stone mb-8 font-sans text-sm">No reviews yet.</p>
      )}

      <ul className="mb-10 flex flex-col gap-6">
        {data?.items.map((review) => (
          <li key={review.id} className="border-mist border-b pb-6">
            <Stars rating={review.rating} />
            {review.title ? (
              <p className="text-ink mt-1 font-sans text-sm font-medium">{review.title}</p>
            ) : null}
            <p className="text-ink mt-1 font-sans text-sm">{review.body}</p>
            <p className="text-stone mt-2 font-sans text-xs">
              {review.authorName} · {new Date(review.createdAt).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>

      {loggedIn ? (
        eligible ? (
          <WriteReviewForm productId={productId} onSubmitted={refresh} />
        ) : null
      ) : (
        <p className="text-stone font-sans text-sm">
          <Link href="/login" className="text-ink underline">
            Sign in
          </Link>{" "}
          to write a review of a product you&apos;ve purchased.
        </p>
      )}
    </div>
  );
}
