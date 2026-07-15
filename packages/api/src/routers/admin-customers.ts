import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission, router } from "../trpc";

const usersRead = requirePermission("users:read");
const usersWrite = requirePermission("users:write");

/**
 * ADMIN_PANEL.md §4.4 — customer management is "primarily a support tool":
 * search/view customer profiles and order history, light contact-info
 * correction. Reuses the pre-existing users:read/users:write permissions
 * (already granted to support/order_manager/viewer in seed.ts), not a new
 * customers:* pair.
 */
export const adminCustomersRouter = router({
  list: usersRead
    .input(
      z.object({
        search: z.string().trim().optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const customers = await prisma.user.findMany({
        where: {
          deletedAt: null,
          ...(input.search
            ? {
                OR: [
                  { email: { contains: input.search, mode: "insensitive" } },
                  { firstName: { contains: input.search, mode: "insensitive" } },
                  { lastName: { contains: input.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { _count: { select: { orders: true } } },
      });

      const hasMore = customers.length > input.limit;
      const items = (hasMore ? customers.slice(0, -1) : customers).map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        emailVerifiedAt: c.emailVerifiedAt,
        orderCount: c._count.orders,
        createdAt: c.createdAt,
      }));
      return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
    }),

  detail: usersRead.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const customer = await prisma.user.findUnique({
      where: { id: input.id },
      include: {
        addresses: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { items: true },
        },
        _count: { select: { orders: true, reviews: true } },
      },
    });
    if (!customer || customer.deletedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
    }
    return customer;
  }),

  updateContactInfo: usersWrite
    .input(
      z.object({
        id: z.string().uuid(),
        firstName: z.string().trim().min(1).optional(),
        lastName: z.string().trim().min(1).optional(),
        phone: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.user.update({
        where: { id: input.id },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
    }),
});
