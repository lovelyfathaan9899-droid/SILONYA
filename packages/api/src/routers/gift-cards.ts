import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

/**
 * Looks up an active, unexpired gift card by code and validates it has a
 * positive balance — shared by the public balance-check query and
 * checkout's redemption step (checkout/shared.ts), so the two never drift.
 */
export async function findRedeemableGiftCard(code: string) {
  const giftCard = await prisma.giftCard.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!giftCard?.isActive) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That gift card code isn't valid." });
  }
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That gift card has expired." });
  }
  if (giftCard.currentBalance <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That gift card has no remaining balance.",
    });
  }
  return giftCard;
}

/** PROMOTIONS — gift card balance check (no login required, matches guest checkout). Redemption itself happens inside checkout.createIntent. */
export const giftCardsRouter = router({
  checkBalance: publicProcedure
    .input(z.object({ code: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      const giftCard = await findRedeemableGiftCard(input.code);
      return {
        currentBalance: giftCard.currentBalance,
        currency: giftCard.currency,
        expiresAt: giftCard.expiresAt,
      };
    }),
});
