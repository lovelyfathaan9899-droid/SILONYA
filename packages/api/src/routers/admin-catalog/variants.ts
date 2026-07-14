import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@silonya/database";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { getDefaultWarehouseId, stripUndefined } from "./shared";

const catalogWrite = requirePermission("catalog:write");

export const variantsRouter = {
  upsert: catalogWrite
    .input(
      z.object({
        id: z.string().uuid().optional(),
        productId: z.string().uuid(),
        sku: z.string().trim().min(1),
        price: z.number().int().min(0).nullable().optional(),
        compareAtPrice: z.number().int().min(0).nullable().optional(),
        weightGrams: z.number().int().min(0).nullable().optional(),
        barcode: z.string().trim().nullable().optional(),
        optionValueIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, productId, optionValueIds, ...fields } = input;
      const cleanFields = stripUndefined(fields);

      return prisma.$transaction(async (tx) => {
        const variant = id
          ? await tx.productVariant.update({ where: { id }, data: cleanFields })
          : await tx.productVariant.create({ data: { productId, ...cleanFields } });

        await tx.variantOptionValue.deleteMany({ where: { variantId: variant.id } });
        if (optionValueIds.length > 0) {
          await tx.variantOptionValue.createMany({
            data: optionValueIds.map((productOptionValueId) => ({
              variantId: variant.id,
              productOptionValueId,
            })),
          });
        }

        if (!id) {
          const warehouseId = await getDefaultWarehouseId();
          await tx.inventory.create({
            data: { variantId: variant.id, warehouseId, quantityOnHand: 0 },
          });
        }

        return variant;
      });
    }),

  delete: catalogWrite.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    try {
      await prisma.productVariant.delete({ where: { id: input.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This variant is referenced by an existing order or cart and can't be deleted.",
        });
      }
      throw error;
    }
    return { success: true };
  }),
};
