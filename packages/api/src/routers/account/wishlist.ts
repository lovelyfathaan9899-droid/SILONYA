import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { customerProcedure, router } from "../../trpc";

const itemInclude = {
  variant: {
    include: {
      product: { include: { media: { orderBy: { position: "asc" as const }, take: 1 } } },
      optionValues: { include: { productOptionValue: true } },
    },
  },
} as const;

function toWishlistItemSummary(item: {
  id: string;
  savedForLater: boolean;
  createdAt: Date;
  variant: {
    id: string;
    price: number | null;
    product: {
      id: string;
      slug: string;
      name: string;
      basePrice: number;
      currency: string;
      media: { url: string; altText: string }[];
    };
    optionValues: { productOptionValue: { value: string } }[];
  };
}) {
  return {
    id: item.id,
    savedForLater: item.savedForLater,
    createdAt: item.createdAt,
    variantId: item.variant.id,
    productId: item.variant.product.id,
    productSlug: item.variant.product.slug,
    productName: item.variant.product.name,
    variantLabel: item.variant.optionValues.map((ov) => ov.productOptionValue.value).join(" / "),
    price: item.variant.price ?? item.variant.product.basePrice,
    currency: item.variant.product.currency,
    image: item.variant.product.media[0] ?? null,
  };
}

/** Ensures every customer has exactly one Wishlist row, created lazily on first use rather than at registration (most accounts may never use it). */
async function getOrCreateWishlistId(userId: string): Promise<string> {
  const existing = await prisma.wishlist.findUnique({ where: { userId } });
  if (existing) return existing.id;
  const created = await prisma.wishlist.create({ data: { userId } });
  return created.id;
}

/**
 * SHOPPING FEATURES — database-backed wishlist synced across devices, plus
 * "save for later" reusing the same WishlistItem bucket with a flag
 * (savedForLater=true means it came from the cart, not the PDP heart
 * button — DATABASE_ARCHITECTURE.md §3.7 comment on WishlistItem).
 */
export const wishlistRouter = router({
  list: customerProcedure.query(async ({ ctx }) => {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId: ctx.customerSession.userId },
      include: { items: { include: itemInclude, orderBy: { createdAt: "desc" } } },
    });
    const items = wishlist?.items.map(toWishlistItemSummary) ?? [];
    return {
      wishlist: items.filter((i) => !i.savedForLater),
      savedForLater: items.filter((i) => i.savedForLater),
    };
  }),

  add: customerProcedure
    .input(z.object({ variantId: z.string().uuid(), savedForLater: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const wishlistId = await getOrCreateWishlistId(ctx.customerSession.userId);
      const item = await prisma.wishlistItem.upsert({
        where: { wishlistId_variantId: { wishlistId, variantId: input.variantId } },
        update: { savedForLater: input.savedForLater },
        create: { wishlistId, variantId: input.variantId, savedForLater: input.savedForLater },
      });
      return item;
    }),

  remove: customerProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const wishlist = await prisma.wishlist.findUnique({
        where: { userId: ctx.customerSession.userId },
      });
      if (!wishlist) return { success: true };
      await prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id, variantId: input.variantId },
      });
      return { success: true };
    }),

  setSavedForLater: customerProcedure
    .input(z.object({ variantId: z.string().uuid(), savedForLater: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const wishlist = await prisma.wishlist.findUnique({
        where: { userId: ctx.customerSession.userId },
      });
      if (!wishlist) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }
      await prisma.wishlistItem.updateMany({
        where: { wishlistId: wishlist.id, variantId: input.variantId },
        data: { savedForLater: input.savedForLater },
      });
      return { success: true };
    }),
});
