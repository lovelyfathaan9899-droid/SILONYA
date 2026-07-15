import { prisma } from "@silonya/database";
import { z } from "zod";
import { customerProcedure, router } from "../../trpc";

/** CUSTOMER ACCOUNT SYSTEM — profile page + editing, account settings. Password changes go through customerAuth.changePassword, not here. */
export const profileRouter = router({
  get: customerProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.customerSession.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerifiedAt: true,
        marketingOptIn: true,
        defaultShippingAddressId: true,
        defaultBillingAddressId: true,
        createdAt: true,
      },
    });
    return user;
  }),

  update: customerProcedure
    .input(
      z.object({
        firstName: z.string().trim().min(1).optional(),
        lastName: z.string().trim().min(1).optional(),
        phone: z.string().trim().min(1).optional(),
        marketingOptIn: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.update({
        where: { id: ctx.customerSession.userId },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.marketingOptIn !== undefined ? { marketingOptIn: input.marketingOptIn } : {}),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          marketingOptIn: true,
        },
      });
      return user;
    }),
});
