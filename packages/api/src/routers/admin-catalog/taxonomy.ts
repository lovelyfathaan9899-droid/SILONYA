import { prisma } from "@silonya/database";
import { z } from "zod";
import { requirePermission } from "../../trpc";
import { uniqueSlug } from "./shared";

const catalogRead = requirePermission("catalog:read");
const catalogWrite = requirePermission("catalog:write");

export const taxonomyRouter = {
  listCategories: catalogRead.query(() => prisma.category.findMany({ orderBy: { name: "asc" } })),

  createCategory: catalogWrite
    .input(
      z.object({
        name: z.string().trim().min(1),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = await uniqueSlug(input.name, async (candidate) => {
        const existing = await prisma.category.findUnique({ where: { slug: candidate } });
        return existing !== null;
      });

      return prisma.category.create({
        data: { name: input.name, slug, parentId: input.parentId ?? null },
      });
    }),

  listCollections: catalogRead.query(() =>
    prisma.collection.findMany({ orderBy: { name: "asc" } }),
  ),

  createCollection: catalogWrite
    .input(z.object({ name: z.string().trim().min(1), description: z.string().trim().optional() }))
    .mutation(async ({ input }) => {
      const slug = await uniqueSlug(input.name, async (candidate) => {
        const existing = await prisma.collection.findUnique({ where: { slug: candidate } });
        return existing !== null;
      });

      return prisma.collection.create({
        data: { name: input.name, slug, description: input.description ?? null },
      });
    }),
};
