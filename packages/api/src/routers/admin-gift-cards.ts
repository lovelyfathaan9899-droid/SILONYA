import { randomBytes } from "node:crypto";
import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission, router } from "../trpc";

const giftCardsRead = requirePermission("gift_cards:read");
const giftCardsWrite = requirePermission("gift_cards:write");

function generateGiftCardCode(): string {
  const bytes = randomBytes(6).toString("hex").toUpperCase();
  return `GC-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
}

/** ADMIN FEATURES — gift card management (issue, list, adjust balance, deactivate). */
export const adminGiftCardsRouter = router({
  list: giftCardsRead
    .input(
      z.object({
        search: z.string().trim().optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const giftCards = await prisma.giftCard.findMany({
        where: input.search
          ? {
              OR: [
                { code: { contains: input.search, mode: "insensitive" } },
                { issuedToEmail: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {},
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = giftCards.length > input.limit;
      const items = hasMore ? giftCards.slice(0, -1) : giftCards;
      return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  detail: giftCardsRead.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: input.id },
      include: { transactions: { orderBy: { createdAt: "desc" }, include: { order: true } } },
    });
    if (!giftCard) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Gift card not found." });
    }
    return giftCard;
  }),

  issue: giftCardsWrite
    .input(
      z.object({
        initialBalance: z.number().int().min(100),
        currency: z.string().trim().length(3).default("USD"),
        issuedToEmail: z.string().trim().email().optional(),
        expiresAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.$transaction(async (tx) => {
        const giftCard = await tx.giftCard.create({
          data: {
            code: generateGiftCardCode(),
            initialBalance: input.initialBalance,
            currentBalance: input.initialBalance,
            currency: input.currency.toUpperCase(),
            issuedToEmail: input.issuedToEmail ?? null,
            expiresAt: input.expiresAt ?? null,
          },
        });
        await tx.giftCardTransaction.create({
          data: { giftCardId: giftCard.id, type: "issued", amount: input.initialBalance },
        });
        return giftCard;
      });
    }),

  adjustBalance: giftCardsWrite
    .input(z.object({ id: z.string().uuid(), amount: z.number().int() }))
    .mutation(async ({ input }) => {
      return prisma.$transaction(async (tx) => {
        const giftCard = await tx.giftCard.findUnique({ where: { id: input.id } });
        if (!giftCard) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Gift card not found." });
        }
        const newBalance = giftCard.currentBalance + input.amount;
        if (newBalance < 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Adjustment would make balance negative.",
          });
        }
        const updated = await tx.giftCard.update({
          where: { id: input.id },
          data: { currentBalance: newBalance },
        });
        await tx.giftCardTransaction.create({
          data: { giftCardId: input.id, type: "adjusted", amount: input.amount },
        });
        return updated;
      });
    }),

  setActive: giftCardsWrite
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      return prisma.giftCard.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),
});
