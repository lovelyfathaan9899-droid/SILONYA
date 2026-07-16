import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

const PAGE_TYPE = z.enum(["editorial", "lookbook", "static_page"]);

/** Public read surface for CMS content — homepage sections, footer, editorial/lookbook/static pages, FAQ. */
export const cmsRouter = router({
  homepageContent: publicProcedure.query(async () => {
    const blocks = await prisma.contentBlock.findMany({ where: { isActive: true } });
    const byType = new Map(blocks.map((b) => [b.type, b]));
    return {
      hero: byType.get("hero") ?? null,
      promoBanner: byType.get("promo_banner") ?? null,
      editorial: byType.get("editorial") ?? null,
    };
  }),

  footer: publicProcedure.query(async () => {
    const links = await prisma.footerLink.findMany({
      where: { isActive: true },
      orderBy: [{ section: "asc" }, { position: "asc" }],
    });
    const bySection = new Map<string, { label: string; href: string }[]>();
    for (const link of links) {
      const existing = bySection.get(link.section) ?? [];
      existing.push({ label: link.label, href: link.href });
      bySection.set(link.section, existing);
    }
    return Array.from(bySection.entries()).map(([section, items]) => ({ section, links: items }));
  }),

  listPages: publicProcedure.input(z.object({ type: PAGE_TYPE })).query(async ({ input }) => {
    return prisma.page.findMany({
      where: { type: input.type, status: "published" },
      orderBy: { publishedAt: "desc" },
      select: {
        slug: true,
        title: true,
        heroImageUrl: true,
        heroImageAlt: true,
        publishedAt: true,
      },
    });
  }),

  getPageBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const page = await prisma.page.findUnique({ where: { slug: input.slug } });
    if (!page) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This page isn't available." });
    }
    if (page.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "This page isn't available." });
    }
    return page;
  }),

  faq: publicProcedure.query(async () => {
    const items = await prisma.faqItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { position: "asc" }],
    });
    const byCategory = new Map<string, { question: string; answer: string }[]>();
    for (const item of items) {
      const key = item.category ?? "General";
      const existing = byCategory.get(key) ?? [];
      existing.push({ question: item.question, answer: item.answer });
      byCategory.set(key, existing);
    }
    return Array.from(byCategory.entries()).map(([category, questions]) => ({
      category,
      questions,
    }));
  }),
});
