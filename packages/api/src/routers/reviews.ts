import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { customerProcedure, publicProcedure, router } from "../trpc";

const REVIEW_UPLOAD_FOLDER = "silonya/reviews";

function requireCloudinaryEnv(): { cloudName: string; apiKey: string; apiSecret: string } {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Image upload isn't configured yet (missing Cloudinary credentials).",
    });
  }
  return { cloudName, apiKey, apiSecret };
}

const reviewCardInclude = {
  user: { select: { firstName: true, lastName: true } },
  media: { orderBy: { position: "asc" as const } },
} as const;

function toReviewSummary(review: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  user: { firstName: string | null; lastName: string | null };
  media: { url: string }[];
}) {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    createdAt: review.createdAt,
    authorName: review.user.firstName ?? "Verified customer",
    media: review.media.map((m) => m.url),
  };
}

/**
 * SHOPPING FEATURES — product reviews/ratings, moderation (status:
 * pending/published/rejected, admin-reviews.ts owns approve/reject),
 * purchase verification (a review may only be created against a product
 * the reviewer has an actual paid order for), and review images.
 */
export const reviewsRouter = router({
  listForProduct: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const [reviews, aggregate] = await Promise.all([
        prisma.review.findMany({
          where: { productId: input.productId, status: "published" },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          include: reviewCardInclude,
        }),
        prisma.review.aggregate({
          where: { productId: input.productId, status: "published" },
          _avg: { rating: true },
          _count: true,
        }),
      ]);

      return {
        items: reviews.map(toReviewSummary),
        averageRating: aggregate._avg.rating ?? 0,
        count: aggregate._count,
      };
    }),

  /** Whether the current customer may review this product, and with which order — drives the PDP's "Write a review" gate. */
  eligibility: customerProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [existingReview, purchaseOrder] = await Promise.all([
        prisma.review.findFirst({
          where: { productId: input.productId, userId: ctx.customerSession.userId },
        }),
        prisma.order.findFirst({
          where: {
            userId: ctx.customerSession.userId,
            status: { notIn: ["pending_payment", "payment_failed", "cancelled"] },
            items: { some: { variant: { productId: input.productId } } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return {
        alreadyReviewed: !!existingReview,
        verifiedPurchase: !!purchaseOrder,
        canReview: !existingReview && !!purchaseOrder,
      };
    }),

  create: customerProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().min(1).max(120).optional(),
        body: z.string().trim().min(1).max(4000),
        mediaUrls: z.array(z.string().url()).max(6).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.review.findFirst({
        where: { productId: input.productId, userId: ctx.customerSession.userId },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You've already reviewed this product." });
      }

      const purchaseOrder = await prisma.order.findFirst({
        where: {
          userId: ctx.customerSession.userId,
          status: { notIn: ["pending_payment", "payment_failed", "cancelled"] },
          items: { some: { variant: { productId: input.productId } } },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!purchaseOrder) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only review products you've purchased.",
        });
      }

      return prisma.review.create({
        data: {
          productId: input.productId,
          userId: ctx.customerSession.userId,
          orderId: purchaseOrder.id,
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
          status: "pending",
          media: { create: input.mediaUrls.map((url, position) => ({ url, position })) },
        },
      });
    }),

  update: customerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().min(1).max(120).optional(),
        body: z.string().trim().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const review = await prisma.review.findUnique({ where: { id: input.id } });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found." });
      }
      if (review.userId !== ctx.customerSession.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found." });
      }
      return prisma.review.update({
        where: { id: input.id },
        data: {
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
          status: "pending", // edits are re-moderated before going live again
        },
      });
    }),

  delete: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const review = await prisma.review.findUnique({ where: { id: input.id } });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found." });
      }
      if (review.userId !== ctx.customerSession.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found." });
      }
      await prisma.review.delete({ where: { id: input.id } });
      return { success: true };
    }),

  mine: customerProcedure.query(async ({ ctx }) => {
    return prisma.review.findMany({
      where: { userId: ctx.customerSession.userId },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true, slug: true } }, media: true },
    });
  }),

  /**
   * `allowed_formats` is part of the signed payload, not just a client-side
   * hint — the upload request to Cloudinary must supply the exact same
   * params to match this signature, and Cloudinary itself rejects any
   * other format/resource type server-side. Without this, any authenticated
   * customer could sign an upload of any file type/size to this folder.
   */
  getUploadSignature: customerProcedure.mutation(() => {
    const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
    const timestamp = Math.round(Date.now() / 1000);
    const params = {
      timestamp,
      folder: REVIEW_UPLOAD_FOLDER,
      allowed_formats: "jpg,jpeg,png,webp,avif",
    };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);
    return { ...params, signature, apiKey, cloudName };
  }),
});
