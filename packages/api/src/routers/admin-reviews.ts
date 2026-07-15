import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission, router } from "../trpc";

const reviewsRead = requirePermission("reviews:read");
const reviewsWrite = requirePermission("reviews:write");

/** ADMIN FEATURES — review moderation. */
export const adminReviewsRouter = router({
  list: reviewsRead
    .input(
      z.object({
        status: z.enum(["pending", "published", "rejected", "all"]).default("pending"),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const reviews = await prisma.review.findMany({
        where: input.status === "all" ? {} : { status: input.status },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          product: { select: { name: true, slug: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
          media: true,
        },
      });

      const hasMore = reviews.length > input.limit;
      const items = hasMore ? reviews.slice(0, -1) : reviews;
      return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  moderate: reviewsWrite
    .input(z.object({ id: z.string().uuid(), status: z.enum(["published", "rejected"]) }))
    .mutation(async ({ input }) => {
      const review = await prisma.review.findUnique({ where: { id: input.id } });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found." });
      }
      return prisma.review.update({ where: { id: input.id }, data: { status: input.status } });
    }),
});
