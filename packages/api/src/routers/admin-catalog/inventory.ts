import { prisma } from "@silonya/database";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { indexProduct } from "../../services/search-index";
import { getDefaultWarehouseId } from "./shared";

const inventoryWrite = requirePermission("inventory:write");

export const inventoryRouter = {
  /**
   * Manual stock adjustment — always audited with a reason
   * (ADMIN_PANEL.md §4.3: "financially significant and must be traceable").
   * Single-warehouse assumption for this phase (see shared.ts).
   */
  adjust: inventoryWrite
    .input(
      z.object({
        variantId: z.string().uuid(),
        quantityOnHand: z.number().int().min(0),
        reason: z.string().trim().min(3),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const warehouseId = await getDefaultWarehouseId();

      const existing = await prisma.inventory.findUnique({
        where: { variantId_warehouseId: { variantId: input.variantId, warehouseId } },
      });

      const updated = await prisma.inventory.upsert({
        where: { variantId_warehouseId: { variantId: input.variantId, warehouseId } },
        create: {
          variantId: input.variantId,
          warehouseId,
          quantityOnHand: input.quantityOnHand,
        },
        update: { quantityOnHand: input.quantityOnHand },
      });

      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "adjust_inventory",
          targetType: "ProductVariant",
          targetId: input.variantId,
          metadata: {
            previousQuantity: existing?.quantityOnHand ?? 0,
            newQuantity: input.quantityOnHand,
            reason: input.reason,
          },
        },
      });

      // Availability (in-stock/out-of-stock) is a filterable search
      // attribute (SEARCH_AND_FILTERS.md §3's "inventory changes... trigger
      // a lightweight availability update") — re-synced in the background,
      // never blocking this response.
      prisma.productVariant
        .findUnique({ where: { id: input.variantId }, select: { productId: true } })
        .then((variant) => {
          if (variant) {
            indexProduct(variant.productId).catch((err: unknown) => {
              console.error(
                `[admin-catalog] background index sync failed for ${variant.productId}:`,
                err,
              );
            });
          }
        })
        .catch((err: unknown) => {
          console.error("[admin-catalog] failed to look up variant for index sync:", err);
        });

      return updated;
    }),
};
