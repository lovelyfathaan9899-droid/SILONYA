"use client";

import { useEffect } from "react";
import { Button, ErrorState, Section } from "@silonya/ui";

export default function GlobalError({
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
      <ErrorState action={<Button onClick={reset}>Try again</Button>} />
    </Section>
  );
}
