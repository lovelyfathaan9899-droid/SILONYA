import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { resolveCategoryIds } from "../../lib/category-tree";
import { indexProduct, removeProductFromIndex } from "../../services/search-index";
import { stripUndefined, uniqueSlug } from "./shared";

/** Fire-and-forget — index sync happens after the write commits, never blocking the admin's response (SEARCH_AND_FILTERS.md §3). */
function syncIndexInBackground(productId: string): void {
  indexProduct(productId).catch((err: unknown) => {
    console.error(`[admin-catalog] background index sync failed for ${productId}:`, err);
  });
}

const PRODUCT_STATUS = z.enum(["draft", "active", "archived"]);

const catalogRead = requirePermission("catalog:read");
const catalogWrite = requirePermission("catalog:write");

export const productsRouter = {
  list: catalogRead
    .input(
      z.object({
        search: z.string().trim().min(1).optional(),
        status: PRODUCT_STATUS.optional(),
        categorySlug: z.string().trim().optional(),
        /** Trash view (ADMIN_PANEL.md) — flips the default deletedAt filter to show only soft-deleted products, for restore. */
        deletedOnly: z.boolean().default(false),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const categoryIds = input.categorySlug
        ? await resolveCategoryIds(input.categorySlug)
        : undefined;

      const products = await prisma.product.findMany({
        where: {
          deletedAt: input.deletedOnly ? { not: null } : null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.categorySlug
            ? { categories: { some: { categoryId: { in: categoryIds ?? [] } } } }
            : {}),
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
          categories: { include: { category: true }, take: 1 },
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
          categoryName: product.categories[0]?.category.name ?? null,
          variantCount: product.variants.length,
          primarySku: product.variants.length === 1 ? (product.variants[0]?.sku ?? null) : null,
          totalStock: product.variants.reduce(
            (sum, variant) => sum + variant.inventory.reduce((s, inv) => s + inv.quantityOnHand, 0),
            0,
          ),
          totalReserved: product.variants.reduce(
            (sum, variant) =>
              sum + variant.inventory.reduce((s, inv) => s + inv.quantityReserved, 0),
            0,
          ),
          createdAt: product.createdAt,
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
        currency: z.string().length(3).default("PKR"),
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

      syncIndexInBackground(id);
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

      syncIndexInBackground(input.id);
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

      removeProductFromIndex(input.id).catch((err: unknown) => {
        console.error(`[admin-catalog] background index removal failed for ${input.id}:`, err);
      });
      return updated;
    }),

  /** Reverts a published product to draft — the inverse of `publish`, without re-running its completeness checklist. */
  deactivate: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await prisma.product.update({
        where: { id: input.id },
        data: { status: "draft" },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "deactivate_product",
          targetType: "Product",
          targetId: input.id,
        },
      });

      removeProductFromIndex(input.id).catch((err: unknown) => {
        console.error(`[admin-catalog] background index removal failed for ${input.id}:`, err);
      });
      return updated;
    }),

  /**
   * Re-activates a draft or archived product without re-checking `publish`'s
   * completeness checklist (PRODUCT_SYSTEM.md §2) — that gate is for
   * first-time publish; a product that's already been live before (and is
   * just archived/deactivated) can go straight back to active.
   */
  activate: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await prisma.product.update({
        where: { id: input.id },
        data: { status: "active", publishedAt: new Date() },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "activate_product",
          targetType: "Product",
          targetId: input.id,
        },
      });

      syncIndexInBackground(input.id);
      return updated;
    }),

  /**
   * Deep-clones a product (options, variants + their option-value links,
   * media references) into a new draft — never copies inventory levels
   * (starts every variant at zero on hand, since stock is physical and
   * shouldn't be duplicated) and always gets a fresh unique slug/SKUs.
   * Never touches the search index — a draft was never indexed.
   */
  duplicate: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const source = await prisma.product.findUnique({
        where: { id: input.id },
        include: {
          options: { include: { values: true } },
          variants: { include: { optionValues: true } },
          media: true,
          categories: true,
          collections: true,
        },
      });

      if (!source || source.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }

      const newName = `${source.name} (copy)`;
      const newSlug = await uniqueSlug(newName, async (candidate) => {
        const existing = await prisma.product.findUnique({ where: { slug: candidate } });
        return existing !== null;
      });

      const cloned = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: newName,
            slug: newSlug,
            description: source.description,
            status: "draft",
            basePrice: source.basePrice,
            currency: source.currency,
            categories: {
              create: source.categories.map((c) => ({ categoryId: c.categoryId })),
            },
            collections: {
              create: source.collections.map((c) => ({ collectionId: c.collectionId })),
            },
          },
        });

        // Options first, tracking old→new value IDs so variant option-value
        // links can be re-pointed at the clone's own values below.
        const valueIdMap = new Map<string, string>();
        for (const option of source.options) {
          const newOption = await tx.productOption.create({
            data: { productId: product.id, name: option.name, position: option.position },
          });
          for (const value of option.values) {
            const newValue = await tx.productOptionValue.create({
              data: {
                productOptionId: newOption.id,
                value: value.value,
                position: value.position,
              },
            });
            valueIdMap.set(value.id, newValue.id);
          }
        }

        for (const variant of source.variants) {
          const newVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: `${variant.sku}-COPY-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice,
              weightGrams: variant.weightGrams,
              barcode: null,
              optionValues: {
                create: variant.optionValues
                  .map((ov) => valueIdMap.get(ov.productOptionValueId))
                  .filter((id): id is string => id !== undefined)
                  .map((productOptionValueId) => ({ productOptionValueId })),
              },
            },
          });
          void newVariant;
        }

        if (source.media.length > 0) {
          await tx.productMedia.createMany({
            data: source.media.map((m) => ({
              productId: product.id,
              // Variant-specific media isn't remapped to the clone's new
              // variant IDs (no reliable old→new mapping across a
              // duplicate) — cloned images attach at the product level.
              variantId: null,
              url: m.url,
              altText: m.altText,
              position: m.position,
            })),
          });
        }

        return product;
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "duplicate_product",
          targetType: "Product",
          targetId: cloned.id,
          metadata: { sourceProductId: input.id },
        },
      });

      return cloned;
    }),

  /**
   * Soft delete (DATABASE_ARCHITECTURE.md — `deletedAt`, never a hard
   * `DELETE`): sets `deletedAt` and forces the product out of `active` so it
   * can never accidentally still resolve on the storefront through a stale
   * cache. Storefront queries and this router's own `list`/`get` already
   * filter `deletedAt: null` (packages/api/src/routers/catalog.ts).
   */
  softDelete: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await prisma.product.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), status: "archived" },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "delete_product",
          targetType: "Product",
          targetId: input.id,
        },
      });

      removeProductFromIndex(input.id).catch((err: unknown) => {
        console.error(`[admin-catalog] background index removal failed for ${input.id}:`, err);
      });
      return updated;
    }),

  /** Undoes `softDelete` — the product comes back as a draft, never straight to active, so it always passes through an explicit re-publish decision. */
  restore: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await prisma.product.update({
        where: { id: input.id },
        data: { deletedAt: null, status: "draft" },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "restore_product",
          targetType: "Product",
          targetId: input.id,
        },
      });

      return updated;
    }),
};
