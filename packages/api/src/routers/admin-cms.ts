import { prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePermission, router } from "../trpc";

const contentRead = requirePermission("content:read");
const contentWrite = requirePermission("content:write");

const CONTENT_BLOCK_TYPE = z.enum(["hero", "promo_banner", "editorial"]);
const PAGE_TYPE = z.enum(["editorial", "lookbook", "static_page"]);
const PAGE_STATUS = z.enum(["draft", "published"]);

// Unlike imageUrl (z.string().url()), these render as a real <Link href>/
// <a href> on public storefront pages (Hero CTA, footer) — a bare
// z.string() lets an admin store `javascript:...`, which then executes for
// every visitor who clicks it (stored XSS, SECURITY_ARCHITECTURE.md §3.2).
// Only relative paths and http(s) URLs are accepted.
const SAFE_HREF_PATTERN = /^\/|^https?:\/\//i;

/** ctaHref is optional and, per the Hero/EditorialSection components' `ctaLabel && ctaHref` check, an empty string is the "no CTA" state — allowed here, everything else must be a safe scheme. */
const SAFE_HREF_OPTIONAL = z
  .string()
  .trim()
  .max(300)
  .refine(
    (value) => value === "" || SAFE_HREF_PATTERN.test(value),
    "Must be a relative path (starting with /) or an http(s) URL.",
  );

const SAFE_HREF_REQUIRED = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) => SAFE_HREF_PATTERN.test(value),
    "Must be a relative path (starting with /) or an http(s) URL.",
  );

/**
 * ADMIN_PANEL.md §4.6 — structured-content editor (hero/promo/editorial
 * singletons, editorial/lookbook/static pages, FAQ, footer links), not a
 * page builder. `body` fields are plain text (paragraphs split on blank
 * lines at render time in apps/web) — deliberately no rich-text/HTML
 * storage, so there's no `dangerouslySetInnerHTML` XSS surface to sanitize
 * (SECURITY_ARCHITECTURE.md §3.2) in the first place.
 */
export const adminCmsRouter = router({
  contentBlocks: router({
    list: contentRead.query(async () => {
      return prisma.contentBlock.findMany({ orderBy: { type: "asc" } });
    }),

    upsert: contentWrite
      .input(
        z.object({
          type: CONTENT_BLOCK_TYPE,
          eyebrow: z.string().trim().max(60).optional(),
          heading: z.string().trim().max(160).optional(),
          subheading: z.string().trim().max(240).optional(),
          body: z.string().trim().max(2000).optional(),
          imageUrl: z.string().url().optional(),
          imageAlt: z.string().trim().max(200).optional(),
          ctaLabel: z.string().trim().max(60).optional(),
          ctaHref: SAFE_HREF_OPTIONAL.optional(),
          isActive: z.boolean().default(true),
        }),
      )
      .mutation(async ({ input }) => {
        const { type, ...fields } = input;
        return prisma.contentBlock.upsert({
          where: { type },
          update: {
            eyebrow: fields.eyebrow ?? null,
            heading: fields.heading ?? null,
            subheading: fields.subheading ?? null,
            body: fields.body ?? null,
            imageUrl: fields.imageUrl ?? null,
            imageAlt: fields.imageAlt ?? null,
            ctaLabel: fields.ctaLabel ?? null,
            ctaHref: fields.ctaHref ?? null,
            isActive: fields.isActive,
          },
          create: {
            type,
            eyebrow: fields.eyebrow ?? null,
            heading: fields.heading ?? null,
            subheading: fields.subheading ?? null,
            body: fields.body ?? null,
            imageUrl: fields.imageUrl ?? null,
            imageAlt: fields.imageAlt ?? null,
            ctaLabel: fields.ctaLabel ?? null,
            ctaHref: fields.ctaHref ?? null,
            isActive: fields.isActive,
          },
        });
      }),
  }),

  pages: router({
    list: contentRead.input(z.object({ type: PAGE_TYPE.optional() })).query(async ({ input }) => {
      return prisma.page.findMany({
        where: input.type ? { type: input.type } : {},
        orderBy: { updatedAt: "desc" },
      });
    }),

    get: contentRead.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
      const page = await prisma.page.findUnique({ where: { id: input.id } });
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      return page;
    }),

    create: contentWrite
      .input(
        z.object({
          slug: z
            .string()
            .trim()
            .toLowerCase()
            .regex(
              /^[a-z0-9-]+$/,
              "Slug may only contain lowercase letters, numbers, and hyphens.",
            ),
          type: PAGE_TYPE,
          title: z.string().trim().min(1).max(160),
          heroImageUrl: z.string().url().optional(),
          heroImageAlt: z.string().trim().max(200).optional(),
          body: z.string().trim().min(1),
          seoTitle: z.string().trim().max(70).optional(),
          seoDescription: z.string().trim().max(160).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const existing = await prisma.page.findUnique({ where: { slug: input.slug } });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A page with this slug already exists.",
          });
        }
        return prisma.page.create({
          data: {
            slug: input.slug,
            type: input.type,
            title: input.title,
            heroImageUrl: input.heroImageUrl ?? null,
            heroImageAlt: input.heroImageAlt ?? null,
            body: input.body,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
          },
        });
      }),

    update: contentWrite
      .input(
        z.object({
          id: z.string().uuid(),
          title: z.string().trim().min(1).max(160).optional(),
          heroImageUrl: z.string().url().optional(),
          heroImageAlt: z.string().trim().max(200).optional(),
          body: z.string().trim().min(1).optional(),
          seoTitle: z.string().trim().max(70).optional(),
          seoDescription: z.string().trim().max(160).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        return prisma.page.update({
          where: { id },
          data: {
            ...(fields.title !== undefined ? { title: fields.title } : {}),
            ...(fields.heroImageUrl !== undefined ? { heroImageUrl: fields.heroImageUrl } : {}),
            ...(fields.heroImageAlt !== undefined ? { heroImageAlt: fields.heroImageAlt } : {}),
            ...(fields.body !== undefined ? { body: fields.body } : {}),
            ...(fields.seoTitle !== undefined ? { seoTitle: fields.seoTitle } : {}),
            ...(fields.seoDescription !== undefined
              ? { seoDescription: fields.seoDescription }
              : {}),
          },
        });
      }),

    setStatus: contentWrite
      .input(z.object({ id: z.string().uuid(), status: PAGE_STATUS }))
      .mutation(async ({ input }) => {
        return prisma.page.update({
          where: { id: input.id },
          data: {
            status: input.status,
            publishedAt: input.status === "published" ? new Date() : null,
          },
        });
      }),

    delete: contentWrite.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
      await prisma.page.delete({ where: { id: input.id } });
      return { success: true };
    }),
  }),

  faq: router({
    list: contentRead.query(async () => {
      return prisma.faqItem.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }] });
    }),

    create: contentWrite
      .input(
        z.object({
          category: z.string().trim().max(60).optional(),
          question: z.string().trim().min(1).max(300),
          answer: z.string().trim().min(1).max(2000),
        }),
      )
      .mutation(async ({ input }) => {
        const last = await prisma.faqItem.findFirst({ orderBy: { position: "desc" } });
        return prisma.faqItem.create({
          data: {
            category: input.category ?? null,
            question: input.question,
            answer: input.answer,
            position: (last?.position ?? -1) + 1,
          },
        });
      }),

    update: contentWrite
      .input(
        z.object({
          id: z.string().uuid(),
          category: z.string().trim().max(60).optional(),
          question: z.string().trim().min(1).max(300).optional(),
          answer: z.string().trim().min(1).max(2000).optional(),
          position: z.number().int().min(0).optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        return prisma.faqItem.update({
          where: { id },
          data: {
            ...(fields.category !== undefined ? { category: fields.category } : {}),
            ...(fields.question !== undefined ? { question: fields.question } : {}),
            ...(fields.answer !== undefined ? { answer: fields.answer } : {}),
            ...(fields.position !== undefined ? { position: fields.position } : {}),
            ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
          },
        });
      }),

    delete: contentWrite.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
      await prisma.faqItem.delete({ where: { id: input.id } });
      return { success: true };
    }),
  }),

  footerLinks: router({
    list: contentRead.query(async () => {
      return prisma.footerLink.findMany({ orderBy: [{ section: "asc" }, { position: "asc" }] });
    }),

    create: contentWrite
      .input(
        z.object({
          section: z.string().trim().min(1).max(60),
          label: z.string().trim().min(1).max(100),
          href: SAFE_HREF_REQUIRED,
        }),
      )
      .mutation(async ({ input }) => {
        const last = await prisma.footerLink.findFirst({
          where: { section: input.section },
          orderBy: { position: "desc" },
        });
        return prisma.footerLink.create({
          data: { ...input, position: (last?.position ?? -1) + 1 },
        });
      }),

    update: contentWrite
      .input(
        z.object({
          id: z.string().uuid(),
          section: z.string().trim().min(1).max(60).optional(),
          label: z.string().trim().min(1).max(100).optional(),
          href: SAFE_HREF_REQUIRED.optional(),
          position: z.number().int().min(0).optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        return prisma.footerLink.update({
          where: { id },
          data: {
            ...(fields.section !== undefined ? { section: fields.section } : {}),
            ...(fields.label !== undefined ? { label: fields.label } : {}),
            ...(fields.href !== undefined ? { href: fields.href } : {}),
            ...(fields.position !== undefined ? { position: fields.position } : {}),
            ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
          },
        });
      }),

    delete: contentWrite.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
      await prisma.footerLink.delete({ where: { id: input.id } });
      return { success: true };
    }),
  }),
});
