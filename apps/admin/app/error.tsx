"use client";

import { useEffect } from "react";
import { Button, ErrorState, Section } from "@silonya/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section spacing="lg">
      <ErrorState
        title="Something went wrong"
        description="An unexpected error occurred. Try again, or refresh the page."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Section>
  );
}
