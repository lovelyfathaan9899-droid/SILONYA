import { Container, Section } from "@silonya/ui";
import Link from "next/link";

// ADMIN_PANEL.md §4.1 — "not a full BI tool," an at-a-glance summary.
// KPI tiles (today's orders, revenue, low-stock alerts) are added once the
// order/inventory data behind them actually exists.
export default function OverviewPage() {
  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <h1 className="font-display text-ink text-2xl">Overview</h1>
        <p className="text-stone mt-2 max-w-prose font-sans text-sm">
          Order and revenue summaries will appear here once the storefront is live. For now,{" "}
          <Link href="/products" className="text-ink underline underline-offset-4">
            manage the product catalog
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
