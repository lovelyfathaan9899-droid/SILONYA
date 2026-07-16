import { prisma } from "@silonya/database";
import { toCsv } from "@silonya/utils";
import ExcelJS from "exceljs";

export type ReportPeriod = "daily" | "weekly" | "monthly";

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export interface ReportSummary {
  period: ReportPeriod;
  rangeLabel: string;
  startsAt: Date;
  endsAt: Date;
  revenue: number;
  orders: number;
  newCustomers: number;
  discountGiven: number;
  giftCardRedeemed: number;
  topProducts: { name: string; unitsSold: number; revenue: number }[];
}

function periodRange(
  period: ReportPeriod,
  anchor: Date,
): { startsAt: Date; endsAt: Date; label: string } {
  const endsAt = new Date(anchor);
  endsAt.setHours(23, 59, 59, 999);

  if (period === "daily") {
    const startsAt = new Date(anchor);
    startsAt.setHours(0, 0, 0, 0);
    return { startsAt, endsAt, label: startsAt.toISOString().slice(0, 10) };
  }
  if (period === "weekly") {
    const startsAt = new Date(anchor);
    startsAt.setDate(startsAt.getDate() - startsAt.getDay());
    startsAt.setHours(0, 0, 0, 0);
    const weekEnd = new Date(startsAt);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return {
      startsAt,
      endsAt: weekEnd,
      label: `${startsAt.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}`,
    };
  }
  const startsAt = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    startsAt,
    endsAt: monthEnd,
    label: startsAt.toLocaleDateString("en-US", { year: "numeric", month: "long" }),
  };
}

/** Report generation (daily/weekly/monthly) — reuses the same aggregate shape as admin-analytics.ts, scoped to one period window instead of a rolling N-day series. */
export async function generateReport(
  period: ReportPeriod,
  anchor: Date = new Date(),
): Promise<ReportSummary> {
  const { startsAt, endsAt, label } = periodRange(period, anchor);

  const [orderAgg, newCustomers, topProducts] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: [...PAID_STATUSES] }, placedAt: { gte: startsAt, lte: endsAt } },
      _sum: { grandTotal: true, discountTotal: true, giftCardTotal: true },
      _count: true,
    }),
    prisma.user.count({ where: { createdAt: { gte: startsAt, lte: endsAt }, deletedAt: null } }),
    prisma.$queryRaw<{ name: string; unitsSold: bigint; revenue: bigint }[]>`
      SELECT p.name, SUM(oi.quantity)::bigint AS "unitsSold", SUM(oi.line_total)::bigint AS revenue
      FROM order_items oi
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid', 'processing', 'shipped', 'delivered')
        AND o.placed_at >= ${startsAt} AND o.placed_at <= ${endsAt}
      GROUP BY p.name
      ORDER BY "unitsSold" DESC
      LIMIT 10
    `,
  ]);

  return {
    period,
    rangeLabel: label,
    startsAt,
    endsAt,
    revenue: orderAgg._sum.grandTotal ?? 0,
    orders: orderAgg._count,
    newCustomers,
    discountGiven: orderAgg._sum.discountTotal ?? 0,
    giftCardRedeemed: orderAgg._sum.giftCardTotal ?? 0,
    topProducts: topProducts.map((row) => ({
      name: row.name,
      unitsSold: Number(row.unitsSold),
      revenue: Number(row.revenue),
    })),
  };
}

function toDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function reportToCsv(summary: ReportSummary): string {
  const summaryCsv = toCsv([
    {
      Period: summary.rangeLabel,
      "Revenue (USD)": toDollars(summary.revenue),
      Orders: summary.orders,
      "New Customers": summary.newCustomers,
      "Discount Given (USD)": toDollars(summary.discountGiven),
      "Gift Card Redeemed (USD)": toDollars(summary.giftCardRedeemed),
    },
  ]);
  const productsCsv = toCsv(
    summary.topProducts.map((p) => ({
      Product: p.name,
      "Units Sold": p.unitsSold,
      "Revenue (USD)": toDollars(p.revenue),
    })),
  );
  return ["Summary", summaryCsv, "", "Top Products", productsCsv].join("\r\n");
}

export async function reportToExcelBuffer(summary: ReportSummary): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 24 },
    { header: "Value", key: "value", width: 20 },
  ];
  summarySheet.addRows([
    { metric: "Period", value: summary.rangeLabel },
    { metric: "Revenue (USD)", value: toDollars(summary.revenue) },
    { metric: "Orders", value: summary.orders },
    { metric: "New Customers", value: summary.newCustomers },
    { metric: "Discount Given (USD)", value: toDollars(summary.discountGiven) },
    { metric: "Gift Card Redeemed (USD)", value: toDollars(summary.giftCardRedeemed) },
  ]);

  const productsSheet = workbook.addWorksheet("Top Products");
  productsSheet.columns = [
    { header: "Product", key: "name", width: 32 },
    { header: "Units Sold", key: "unitsSold", width: 14 },
    { header: "Revenue (USD)", key: "revenue", width: 16 },
  ];
  productsSheet.addRows(
    summary.topProducts.map((p) => ({
      name: p.name,
      unitsSold: p.unitsSold,
      revenue: toDollars(p.revenue),
    })),
  );

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
