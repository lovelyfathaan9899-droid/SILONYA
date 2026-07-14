import Link from "next/link";
import { Button, EmptyState, Section } from "@silonya/ui";

export default function NotFound() {
  return (
    <Section spacing="lg">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Button asChild>
            <Link href="/">Back to shop</Link>
          </Button>
        }
      />
    </Section>
  );
}
