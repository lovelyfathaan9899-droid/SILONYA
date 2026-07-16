import { prisma } from "@silonya/database";
import { z } from "zod";
import { requirePermission, router } from "../trpc";

const analyticsRead = requirePermission("analytics:read");

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;
const LOW_STOCK_THRESHOLD = 5;

/**
 * ADMIN_PANEL.md §4.1 — "at-a-glance operational summary," not a full BI
 * tool (deep analytics live in PostHog, not configured in this
 * environment). Every query here is a direct Postgres aggregate over
 * existing order/customer/inventory/promotion data — no new tracking
 * infrastructure.
 */
export const adminAnalyticsRouter = router({
  summary: analyticsRead.query(async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, weekAgg, monthAgg, lowStockCount, totalCustomers] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, placedAt: { gte: startOfToday } },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, placedAt: { gte: startOfWeek } },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: { in: [...PAID_STATUSES] }, placedAt: { gte: startOfMonth } },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM inventory
        WHERE quantity_on_hand - quantity_reserved <= ${LOW_STOCK_THRESHOLD}
      `,
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      today: { revenue: todayAgg._sum.grandTotal ?? 0, orders: todayAgg._count },
      week: { revenue: weekAgg._sum.grandTotal ?? 0, orders: weekAgg._count },
      month: { revenue: monthAgg._sum.grandTotal ?? 0, orders: monthAgg._count },
      lowStockCount: Number(lowStockCount[0]?.count ?? 0),
      totalCustomers,
    };
  }),

  revenueByDay: analyticsRead
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await prisma.$queryRaw<{ day: Date; revenue: bigint; orders: bigint }[]>`
        SELECT date_trunc('day', placed_at) AS day,
               SUM(grand_total)::bigint AS revenue,
               COUNT(*)::bigint AS orders
        FROM orders
        WHERE status IN ('paid', 'processing', 'shipped', 'delivered')
          AND placed_at >= ${since}
        GROUP BY day
        ORDER BY day ASC
      `;
      return rows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        revenue: Number(row.revenue),
        orders: Number(row.orders),
      }));
    }),

  ordersByStatus: analyticsRead.query(async () => {
    const rows = await prisma.order.groupBy({ by: ["status"], _count: true });
    return rows.map((row) => ({ status: row.status, count: row._count }));
  }),

  customersByDay: analyticsRead
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
        FROM users
        WHERE created_at >= ${since} AND deleted_at IS NULL
        GROUP BY day
        ORDER BY day ASC
      `;
      return rows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      }));
    }),

  bestSellers: analyticsRead
    .input(
      z.object({
        days: z.number().int().min(1).max(365).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      const since = input.days ? new Date(Date.now() - input.days * 24 * 60 * 60 * 1000) : null;
      const rows = since
        ? await prisma.$queryRaw<
            { productId: string; name: string; unitsSold: bigint; revenue: bigint }[]
          >`
            SELECT p.id AS "productId", p.name, SUM(oi.quantity)::bigint AS "unitsSold", SUM(oi.line_total)::bigint AS revenue
            FROM order_items oi
            JOIN product_variants pv ON pv.id = oi.variant_id
            JOIN products p ON p.id = pv.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status IN ('paid', 'processing', 'shipped', 'delivered')
              AND o.placed_at >= ${since}
            GROUP BY p.id, p.name
            ORDER BY "unitsSold" DESC
            LIMIT ${input.limit}
          `
        : await prisma.$queryRaw<
            { productId: string; name: string; unitsSold: bigint; revenue: bigint }[]
          >`
            SELECT p.id AS "productId", p.name, SUM(oi.quantity)::bigint AS "unitsSold", SUM(oi.line_total)::bigint AS revenue
            FROM order_items oi
            JOIN product_variants pv ON pv.id = oi.variant_id
            JOIN products p ON p.id = pv.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status IN ('paid', 'processing', 'shipped', 'delivered')
            GROUP BY p.id, p.name
            ORDER BY "unitsSold" DESC
            LIMIT ${input.limit}
          `;
      return rows.map((row) => ({
        productId: row.productId,
        name: row.name,
        unitsSold: Number(row.unitsSold),
        revenue: Number(row.revenue),
      }));
    }),

  lowStock: analyticsRead
    .input(z.object({ threshold: z.number().int().min(0).default(LOW_STOCK_THRESHOLD) }))
    .query(async ({ input }) => {
      const rows = await prisma.$queryRaw<
        {
          variantId: string;
          sku: string;
          productName: string;
          quantityOnHand: number;
          quantityReserved: number;
        }[]
      >`
        SELECT pv.id AS "variantId", pv.sku, p.name AS "productName", i.quantity_on_hand AS "quantityOnHand", i.quantity_reserved AS "quantityReserved"
        FROM inventory i
        JOIN product_variants pv ON pv.id = i.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE i.quantity_on_hand - i.quantity_reserved <= ${input.threshold}
          AND p.deleted_at IS NULL
        ORDER BY (i.quantity_on_hand - i.quantity_reserved) ASC
      `;
      return rows;
    }),

  /**
   * (paid orders / new accounts) over the same window — an operational
   * proxy, not a true visit-to-purchase conversion rate (that requires
   * session/pageview tracking, which needs PostHog — not configured in
   * this environment, TECH_STACK.md §... "Product analytics: PostHog").
   */
  conversionRateProxy: analyticsRead
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const [orders, newAccounts] = await Promise.all([
        prisma.order.count({
          where: { status: { in: [...PAID_STATUSES] }, placedAt: { gte: since } },
        }),
        prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      ]);
      return {
        orders,
        newAccounts,
        rate: newAccounts > 0 ? orders / newAccounts : null,
        isProxy: true,
      };
    }),

  couponUsage: analyticsRead.query(async () => {
    const discounts = await prisma.discount.findMany({
      include: { _count: { select: { redemptions: true } } },
    });
    const results = await Promise.all(
      discounts.map(async (discount) => {
        const orders = await prisma.order.aggregate({
          where: { discountId: discount.id },
          _sum: { discountTotal: true },
        });
        return {
          id: discount.id,
          code: discount.code,
          type: discount.type,
          redemptions: discount._count.redemptions,
          totalDiscountGiven: orders._sum.discountTotal ?? 0,
        };
      }),
    );
    return results.sort((a, b) => b.redemptions - a.redemptions);
  }),

  giftCardUsage: analyticsRead.query(async () => {
    const [issued, redeemed, refunded, adjusted, outstanding] = await Promise.all([
      prisma.giftCardTransaction.aggregate({ where: { type: "issued" }, _sum: { amount: true } }),
      prisma.giftCardTransaction.aggregate({ where: { type: "redeemed" }, _sum: { amount: true } }),
      prisma.giftCardTransaction.aggregate({ where: { type: "refunded" }, _sum: { amount: true } }),
      prisma.giftCardTransaction.aggregate({ where: { type: "adjusted" }, _sum: { amount: true } }),
      prisma.giftCard.aggregate({ _sum: { currentBalance: true }, where: { isActive: true } }),
    ]);
    return {
      totalIssued: issued._sum.amount ?? 0,
      totalRedeemed: redeemed._sum.amount ?? 0,
      totalRefunded: refunded._sum.amount ?? 0,
      totalAdjusted: adjusted._sum.amount ?? 0,
      outstandingBalance: outstanding._sum.currentBalance ?? 0,
    };
  }),
});
