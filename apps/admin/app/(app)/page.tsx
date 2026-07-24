"use client";

import { Container, Section } from "@silonya/ui";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { formatPKR } from "@/lib/currency";
import { trpc } from "@/lib/trpc";

/** At-a-glance operational summary (ADMIN_PANEL.md §4.1 — "not a full BI tool"), reusing the same summary/lowStock queries analytics/page.tsx charts in more depth. */
export default function OverviewPage() {
  const summary = trpc.adminAnalytics.summary.useQuery();
  const lowStock = trpc.adminAnalytics.lowStock.useQuery({});

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Overview</h1>
          <Link
            href="/analytics"
            className="text-ink font-sans text-sm underline underline-offset-4"
          >
            Full analytics
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Revenue today"
            value={formatPKR(summary.data?.today.revenue ?? 0)}
            sub={`${String(summary.data?.today.orders ?? 0)} orders`}
          />
          <StatCard
            label="Revenue this week"
            value={formatPKR(summary.data?.week.revenue ?? 0)}
            sub={`${String(summary.data?.week.orders ?? 0)} orders`}
          />
          <StatCard
            label="Revenue this month"
            value={formatPKR(summary.data?.month.revenue ?? 0)}
            sub={`${String(summary.data?.month.orders ?? 0)} orders`}
          />
          <StatCard
            label="Customers"
            value={String(summary.data?.totalCustomers ?? 0)}
            sub="total registered"
          />
        </div>

        <div className="border-mist border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-ink text-lg">Inventory alerts</h2>
            <Link
              href="/products"
              className="text-ink font-sans text-xs underline underline-offset-4"
            >
              Manage catalog
            </Link>
          </div>
          {lowStock.data && lowStock.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {lowStock.data.slice(0, 8).map((item) => (
                <li
                  key={item.variantId}
                  className="flex items-center justify-between font-sans text-sm"
                >
                  <span className="text-ink">
                    {item.productName} — {item.sku}
                  </span>
                  <span className={item.quantityOnHand === 0 ? "text-error" : "text-stone"}>
                    {item.quantityOnHand === 0
                      ? "Out of stock"
                      : `${String(item.quantityOnHand)} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-stone font-sans text-sm">
              Nothing low on stock right now — {String(summary.data?.lowStockCount ?? 0)} item(s)
              flagged.
            </p>
          )}
        </div>
      </Container>
    </Section>
  );
}
