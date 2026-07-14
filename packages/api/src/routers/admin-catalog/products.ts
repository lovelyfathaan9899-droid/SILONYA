import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { stripUndefined, uniqueSlug } from "./shared";

const PRODUCT_STATUS = z.enum(["draft", "active", "archived"]);

const catalogRead = requirePermission("catalog:read");
const catalogWrite = requirePermission("catalog:write");

export const productsRouter = {
  list: catalogRead
    .input(
      z.object({
        search: z.string().trim().min(1).optional(),
        status: PRODUCT_STATUS.optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const products = await prisma.product.findMany({
        where: {
          deletedAt: null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.search
            ? { name: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          media: { orderBy: { position: "asc" }, take: 1 },
          variants: { include: { inventory: true } },
        },
      });

      const hasMore = products.length > input.limit;
      const items = hasMore ? products.slice(0, -1) : products;

      return {
        items: items.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          basePrice: product.basePrice,
          currency: product.currency,
          thumbnailUrl: product.media[0]?.url ?? null,
          variantCount: product.variants.length,
          totalStock: product.variants.reduce(
            (sum, variant) => sum + variant.inventory.reduce((s, inv) => s + inv.quantityOnHand, 0),
            0,
          ),
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  get: catalogRead.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const product = await prisma.product.findUnique({
      where: { id: input.id },
      include: {
        options: {
          orderBy: { position: "asc" },
          include: { values: { orderBy: { position: "asc" } } },
        },
        variants: {
          include: {
            optionValues: { include: { productOptionValue: true } },
            inventory: true,
          },
        },
        media: { orderBy: { position: "asc" } },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
    });

    if (!product || product.deletedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
    }

    return product;
  }),

  create: catalogWrite
    .input(
      z.object({
        name: z.string().trim().min(1),
        basePrice: z.number().int().min(0),
        currency: z.string().length(3).default("USD"),
        description: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = await uniqueSlug(input.name, async (candidate) => {
        const existing = await prisma.product.findUnique({ where: { slug: candidate } });
        return existing !== null;
      });

      return prisma.product.create({
        data: {
          name: input.name,
          slug,
          basePrice: input.basePrice,
          currency: input.currency,
          description: input.description ?? null,
        },
      });
    }),

  update: catalogWrite
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).optional(),
        description: z.string().trim().optional(),
        basePrice: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        seoTitle: z.string().trim().max(70).optional(),
        seoDescription: z.string().trim().max(160).optional(),
        categoryIds: z.array(z.string().uuid()).optional(),
        collectionIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, categoryIds, collectionIds, ...fields } = input;

      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: stripUndefined(fields) });

        if (categoryIds) {
          await tx.productCategory.deleteMany({ where: { productId: id } });
          await tx.productCategory.createMany({
            data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
          });
        }

        if (collectionIds) {
          await tx.productCollection.deleteMany({ where: { productId: id } });
          await tx.productCollection.createMany({
            data: collectionIds.map((collectionId) => ({ productId: id, collectionId })),
          });
        }
      });

      return prisma.product.findUniqueOrThrow({ where: { id } });
    }),

  publish: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const product = await prisma.product.findUnique({
        where: { id: input.id },
        include: {
          variants: true,
          media: true,
          categories: true,
          collections: true,
        },
      });

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }

      // PRODUCT_SYSTEM.md §2 — draft → active completeness checklist.
      const missing: string[] = [];
      if (!product.description?.trim()) missing.push("a description");
      if (product.variants.length === 0) missing.push("at least one variant");
      if (product.variants.some((v) => !v.sku.trim())) missing.push("a SKU on every variant");
      if (
        product.variants.some((v) => (v.price ?? product.basePrice) <= 0) &&
        product.basePrice <= 0
      ) {
        missing.push("a price greater than zero");
      }
      if (product.media.length === 0) missing.push("at least one product image");
      if (product.media.some((m) => !m.altText.trim())) missing.push("alt text on every image");
      if (product.categories.length === 0 && product.collections.length === 0) {
        missing.push("at least one category or collection");
      }

      if (missing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot publish — missing: ${missing.join(", ")}.`,
        });
      }

      const updated = await prisma.product.update({
        where: { id: input.id },
        data: { status: "active", publishedAt: new Date() },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "publish_product",
          targetType: "Product",
          targetId: input.id,
        },
      });

      return updated;
    }),

  archive: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await prisma.product.update({
        where: { id: input.id },
        data: { status: "archived" },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "archive_product",
          targetType: "Product",
          targetId: input.id,
        },
      });

      return updated;
    }),
};
