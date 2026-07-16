import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isMeilisearchConfigured } from "../lib/meilisearch";
import { reindexAll } from "../services/search-index";
import { requirePermission, router } from "../trpc";

const catalogWrite = requirePermission("catalog:write");
const catalogRead = requirePermission("catalog:read");

/** ADMIN FEATURES — search index management + search analytics. */
export const adminSearchRouter = router({
  status: catalogRead.query(() => ({ configured: isMeilisearchConfigured() })),

  reindexAll: catalogWrite.mutation(async () => {
    if (!isMeilisearchConfigured()) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Search indexing isn't configured yet (missing Meilisearch credentials).",
      });
    }
    return reindexAll();
  }),

  popularQueries: catalogRead
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await prisma.searchQueryLog.groupBy({
        by: ["query"],
        where: { createdAt: { gte: since } },
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: input.limit,
      });
      return rows.map((row) => ({ query: row.query, count: row._count.query }));
    }),

  /** Zero-result searches identify catalog gaps or synonym opportunities (SEARCH_AND_FILTERS.md §8). */
  zeroResultQueries: catalogRead
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await prisma.searchQueryLog.groupBy({
        by: ["query"],
        where: { createdAt: { gte: since }, resultCount: 0 },
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: input.limit,
      });
      return rows.map((row) => ({ query: row.query, count: row._count.query }));
    }),
});
