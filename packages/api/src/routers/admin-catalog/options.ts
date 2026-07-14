import { prisma } from "@silonya/database";
import { z } from "zod";
import { requirePermission } from "../../trpc";

const catalogWrite = requirePermission("catalog:write");

const optionValueInput = z.object({
  value: z.string().trim().min(1),
});

const optionInput = z.object({
  name: z.string().trim().min(1),
  values: z.array(optionValueInput).min(1),
});

export const optionsRouter = {
  /**
   * Full replace, not a diff/merge (PRODUCT_SYSTEM.md §1 doesn't mandate
   * stable option/value IDs across edits). Simple and correct for the
   * common case — set options once, then build variants. Editing options
   * *after* variants already reference them detaches those links (the
   * schema cascades the delete), so the admin UI warns before calling this
   * if variants already exist. A stable-ID diff/merge is a reasonable
   * follow-up once real usage shows it's needed (CLAUDE.md — don't build
   * ahead of need).
   */
  upsert: catalogWrite
    .input(
      z.object({
        productId: z.string().uuid(),
        options: z.array(optionInput),
      }),
    )
    .mutation(async ({ input }) => {
      await prisma.$transaction(async (tx) => {
        await tx.productOption.deleteMany({ where: { productId: input.productId } });

        for (const [optionIndex, option] of input.options.entries()) {
          await tx.productOption.create({
            data: {
              productId: input.productId,
              name: option.name,
              position: optionIndex,
              values: {
                create: option.values.map((value, valueIndex) => ({
                  value: value.value,
                  position: valueIndex,
                })),
              },
            },
          });
        }
      });

      return prisma.productOption.findMany({
        where: { productId: input.productId },
        orderBy: { position: "asc" },
        include: { values: { orderBy: { position: "asc" } } },
      });
    }),
};
