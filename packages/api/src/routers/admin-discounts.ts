import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission, router } from "../trpc";

const discountsRead = requirePermission("discounts:read");
const discountsWrite = requirePermission("discounts:write");

const discountInput = z.object({
  code: z.string().trim().toUpperCase().min(1).optional(), // omitted/null = automatic discount (PROMOTIONS)
  type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
  value: z.number().int().min(0),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  usageLimit: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).optional(),
  minimumSubtotal: z.number().int().min(0).optional(),
  eligibleUserIds: z.array(z.string().uuid()).default([]),
});

/** ADMIN FEATURES — coupon management. discounts:read/write permissions already existed (seed.ts) but had no router until now. */
export const adminDiscountsRouter = router({
  list: discountsRead
    .input(
      z.object({
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const discounts = await prisma.discount.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { _count: { select: { redemptions: true, eligibility: true } } },
      });
      const hasMore = discounts.length > input.limit;
      const items = hasMore ? discounts.slice(0, -1) : discounts;
      return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  detail: discountsRead.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const discount = await prisma.discount.findUnique({
      where: { id: input.id },
      include: { eligibility: { include: { user: { select: { email: true } } } } },
    });
    if (!discount) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Discount not found." });
    }
    return discount;
  }),

  create: discountsWrite.input(discountInput).mutation(async ({ input }) => {
    if (input.code) {
      const existing = await prisma.discount.findUnique({ where: { code: input.code } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A discount with this code already exists.",
        });
      }
    }
    return prisma.discount.create({
      data: {
        code: input.code ?? null,
        type: input.type,
        value: input.value,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        usageLimit: input.usageLimit ?? null,
        perUserLimit: input.perUserLimit ?? null,
        minimumSubtotal: input.minimumSubtotal ?? null,
        eligibility: { create: input.eligibleUserIds.map((userId) => ({ userId })) },
      },
    });
  }),

  update: discountsWrite
    .input(discountInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const existing = await prisma.discount.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Discount not found." });
      }
      if (input.code && input.code !== existing.code) {
        const codeInUse = await prisma.discount.findUnique({ where: { code: input.code } });
        if (codeInUse) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A discount with this code already exists.",
          });
        }
      }

      return prisma.$transaction(async (tx) => {
        await tx.discountEligibility.deleteMany({ where: { discountId: input.id } });
        return tx.discount.update({
          where: { id: input.id },
          data: {
            code: input.code ?? null,
            type: input.type,
            value: input.value,
            startsAt: input.startsAt ?? null,
            endsAt: input.endsAt ?? null,
            usageLimit: input.usageLimit ?? null,
            perUserLimit: input.perUserLimit ?? null,
            minimumSubtotal: input.minimumSubtotal ?? null,
            eligibility: { create: input.eligibleUserIds.map((userId) => ({ userId })) },
          },
        });
      });
    }),

  delete: discountsWrite.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    await prisma.discount.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
