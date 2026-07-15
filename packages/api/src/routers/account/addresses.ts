import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { customerProcedure, router } from "../../trpc";

const addressInput = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().min(1),
  countryCode: z.string().trim().length(2),
  phone: z.string().trim().optional(),
});

async function assertOwnedAddress(userId: string, addressId: string): Promise<void> {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Address not found." });
  }
  if (address.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Address not found." });
  }
}

/** CUSTOMER ACCOUNT SYSTEM — saved addresses, default shipping/billing address. */
export const addressesRouter = router({
  list: customerProcedure.query(async ({ ctx }) => {
    return prisma.address.findMany({
      where: { userId: ctx.customerSession.userId },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: customerProcedure.input(addressInput).mutation(async ({ ctx, input }) => {
    return prisma.address.create({
      data: {
        userId: ctx.customerSession.userId,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        region: input.region ?? null,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        phone: input.phone ?? null,
      },
    });
  }),

  update: customerProcedure
    .input(addressInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAddress(ctx.customerSession.userId, input.id);
      return prisma.address.update({
        where: { id: input.id },
        data: {
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          region: input.region ?? null,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          phone: input.phone ?? null,
        },
      });
    }),

  delete: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAddress(ctx.customerSession.userId, input.id);
      await prisma.$transaction(async (tx) => {
        await tx.address.delete({ where: { id: input.id } });
        await tx.user.updateMany({
          where: { id: ctx.customerSession.userId, defaultShippingAddressId: input.id },
          data: { defaultShippingAddressId: null },
        });
        await tx.user.updateMany({
          where: { id: ctx.customerSession.userId, defaultBillingAddressId: input.id },
          data: { defaultBillingAddressId: null },
        });
      });
      return { success: true };
    }),

  setDefaultShipping: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAddress(ctx.customerSession.userId, input.id);
      await prisma.user.update({
        where: { id: ctx.customerSession.userId },
        data: { defaultShippingAddressId: input.id },
      });
      return { success: true };
    }),

  setDefaultBilling: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedAddress(ctx.customerSession.userId, input.id);
      await prisma.user.update({
        where: { id: ctx.customerSession.userId },
        data: { defaultBillingAddressId: input.id },
      });
      return { success: true };
    }),
});
