"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle, Container, Section } from "@silonya/ui";
import { StatCard } from "@/components/StatCard";
import { formatPKR } from "@/lib/currency";
import { MiniBarChart } from "@/components/MiniBarChart";
import { trpc } from "@/lib/trpc";

export default function AnalyticsPage() {
  const summary = trpc.adminAnalytics.summary.useQuery();
  const revenueByDay = trpc.adminAnalytics.revenueByDay.useQuery({ days: 30 });
  const ordersByStatus = trpc.adminAnalytics.ordersByStatus.useQuery();
  const bestSellers = trpc.adminAnalytics.bestSellers.useQuery({ days: 30, limit: 10 });
  const lowStock = trpc.adminAnalytics.lowStock.useQuery({});
  const conversion = trpc.adminAnalytics.conversionRateProxy.useQuery({ days: 30 });
  const couponUsage = trpc.adminAnalytics.couponUsage.useQuery();
  const giftCardUsage = trpc.adminAnalytics.giftCardUsage.useQuery();

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <h1 className="font-display text-ink mb-6 text-2xl">Analytics</h1>

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
            label="Low stock items"
            value={String(summary.data?.lowStockCount ?? 0)}
            sub="≤ 5 units available"
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniBarChart
                data={(revenueByDay.data ?? []).map((d) => ({ label: d.day, value: d.revenue }))}
                formatValue={(v) => formatPKR(v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders by status</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {ordersByStatus.data?.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <Badge variant="outline">{row.status.replace(/_/g, " ")}</Badge>
                    <span className="text-ink font-sans text-sm">{row.count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Best sellers — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              {bestSellers.data?.length === 0 ? (
                <p className="text-stone font-sans text-sm">No sales in this period yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {bestSellers.data?.map((row) => (
                    <li key={row.productId} className="flex items-center justify-between">
                      <span className="text-ink font-sans text-sm">{row.name}</span>
                      <span className="text-stone font-sans text-xs">
                        {row.unitsSold} sold · {formatPKR(row.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStock.data?.length === 0 ? (
                <p className="text-stone font-sans text-sm">Nothing low on stock.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lowStock.data?.map((row) => (
                    <li key={row.variantId} className="flex items-center justify-between">
                      <span className="text-ink font-sans text-sm">
                        {row.productName} <span className="text-stone">({row.sku})</span>
                      </span>
                      <Badge variant="error">
                        {row.quantityOnHand - row.quantityReserved} left
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Conversion (proxy)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-ink font-display text-2xl">
                {conversion.data?.rate !== null && conversion.data?.rate !== undefined
                  ? `${(conversion.data.rate * 100).toFixed(1)}%`
                  : "—"}
              </p>
              <p className="text-stone mt-1 font-sans text-xs">
                {conversion.data?.orders ?? 0} orders / {conversion.data?.newAccounts ?? 0} new
                accounts (30d). Not a true visit-based rate — requires PostHog, not configured.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coupon usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {couponUsage.data?.slice(0, 6).map((row) => (
                  <li key={row.id} className="flex items-center justify-between">
                    <span className="text-ink font-sans text-sm">{row.code ?? "Automatic"}</span>
                    <span className="text-stone font-sans text-xs">
                      {row.redemptions}× · {formatPKR(row.totalDiscountGiven)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gift card usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 font-sans text-sm">
                <li className="text-ink flex justify-between">
                  <span>Issued</span>
                  <span>{formatPKR(giftCardUsage.data?.totalIssued ?? 0)}</span>
                </li>
                <li className="text-ink flex justify-between">
                  <span>Redeemed</span>
                  <span>{formatPKR(giftCardUsage.data?.totalRedeemed ?? 0)}</span>
                </li>
                <li className="text-ink flex justify-between">
                  <span>Outstanding</span>
                  <span>{formatPKR(giftCardUsage.data?.outstandingBalance ?? 0)}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
