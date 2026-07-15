import { prisma } from "@silonya/database";
import { z } from "zod";
import { customerProcedure, router } from "../../trpc";

/** CUSTOMER EXPERIENCE — recently viewed products, persisted per-account (guests get a local-only version; see apps/web's recentlyViewedStore). */
export const recentlyViewedRouter = router({
  track: customerProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.recentlyViewed.upsert({
        where: {
          userId_productId: { userId: ctx.customerSession.userId, productId: input.productId },
        },
        update: { viewedAt: new Date() },
        create: { userId: ctx.customerSession.userId, productId: input.productId },
      });
      return { success: true };
    }),

  list: customerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).default(8) }))
    .query(async ({ ctx, input }) => {
      const entries = await prisma.recentlyViewed.findMany({
        where: { userId: ctx.customerSession.userId },
        orderBy: { viewedAt: "desc" },
        take: input.limit,
        include: {
          product: {
            include: {
              media: { orderBy: { position: "asc" }, take: 1 },
              variants: { select: { price: true } },
            },
          },
        },
      });

      return entries
        .filter((entry) => entry.product.status === "active" && !entry.product.deletedAt)
        .map((entry) => ({
          id: entry.product.id,
          slug: entry.product.slug,
          name: entry.product.name,
          price: entry.product.variants[0]?.price ?? entry.product.basePrice,
          currency: entry.product.currency,
          image: entry.product.media[0] ?? null,
        }));
    }),
});
