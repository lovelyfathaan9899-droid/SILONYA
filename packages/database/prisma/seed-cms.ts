import type { PrismaClient } from "../generated/client/index.js";

/**
 * Sample CMS content (Phase 10 — SEARCH, CMS & ANALYTICS) so the homepage's
 * hero/promo/editorial sections, footer, and a handful of real static/
 * editorial/lookbook pages exist from a fresh seed — replacing the
 * lib/homepage-content.ts and lib/nav-data.ts hardcoded "#" placeholders
 * that predate this phase. Idempotent — safe to re-run.
 */
export async function seedCms(prisma: PrismaClient): Promise<void> {
  await prisma.contentBlock.upsert({
    where: { type: "hero" },
    update: {},
    create: {
      type: "hero",
      eyebrow: "Autumn 2026",
      heading: "Considered pieces, worn for years.",
      subheading: "A collection built on quality cloth and quiet construction — not trend.",
      imageUrl: "https://placehold.co/1920x1400/e7e4de/111111.png?text=SILONYA",
      imageAlt: "SILONYA Autumn collection editorial photograph",
      ctaLabel: "Shop New Arrivals",
      ctaHref: "/collections/new-arrivals",
    },
  });

  await prisma.contentBlock.upsert({
    where: { type: "promo_banner" },
    update: {},
    create: { type: "promo_banner", body: "Complimentary shipping on orders over $200." },
  });

  await prisma.contentBlock.upsert({
    where: { type: "editorial" },
    update: {},
    create: {
      type: "editorial",
      eyebrow: "The Journal",
      heading: "Considered, not trend-driven",
      body: "Every SILONYA piece starts with the cloth. We work with a small group of mills across Italy and Japan, choosing fabrications for how they'll wear in — not just how they photograph on day one.",
      imageUrl: "https://placehold.co/1200x1500/e7e4de/111111.png?text=SILONYA+Journal",
      imageAlt: "Behind the making of a SILONYA wool coat",
      ctaLabel: "Read our story",
      ctaHref: "/collections/the-essentials",
    },
  });
  console.warn("Seeded homepage content blocks (hero, promo banner, editorial).");

  const pages: {
    slug: string;
    type: "static_page" | "editorial" | "lookbook";
    title: string;
    body: string;
    heroImageUrl?: string;
  }[] = [
    {
      slug: "shipping-returns",
      type: "static_page",
      title: "Shipping & Returns",
      body: "We ship worldwide from our fulfillment center. Standard shipping is complimentary on orders over $200; otherwise a flat rate applies at checkout.\n\nReturns are accepted within 30 days of delivery, provided the item is unworn and in its original packaging. Refunds are issued to the original payment method once the return is received and inspected.",
    },
    {
      slug: "size-guide",
      type: "static_page",
      title: "Size Guide",
      body: "SILONYA garments are cut to a considered, true-to-size fit. If you're between sizes, we generally recommend sizing up for outerwear and knitwear, and sizing true-to-size for tailored pieces.\n\nFor precise measurements on a specific item, refer to the size chart on that product's page, or contact us for guidance.",
    },
    {
      slug: "contact",
      type: "static_page",
      title: "Contact",
      body: "For order support, product questions, or anything else, reach us at hello@silonya.com. We aim to respond within one business day.",
    },
    {
      slug: "our-story",
      type: "static_page",
      title: "Our Story",
      body: "SILONYA was founded on a simple idea: clothing should be made to be worn for years, not seasons. We work directly with a small group of mills and workshops, choosing quality of construction over speed to market.",
    },
    {
      slug: "sustainability",
      type: "static_page",
      title: "Sustainability",
      body: "We believe the most sustainable garment is one that lasts. We favor durable natural fibers, limited production runs to avoid overproduction, and manufacturing partners we've vetted for fair labor practices.",
    },
    {
      slug: "careers",
      type: "static_page",
      title: "Careers",
      body: "We're not currently hiring, but we're always glad to hear from people who care about considered, well-made clothing. Reach out at careers@silonya.com.",
    },
    {
      slug: "privacy-policy",
      type: "static_page",
      title: "Privacy Policy",
      body: "We collect only the information necessary to process your orders and, if you opt in, to send you marketing communications. We never sell your personal data. You may request a copy of your data or its deletion at any time by contacting privacy@silonya.com.",
    },
    {
      slug: "terms-of-service",
      type: "static_page",
      title: "Terms of Service",
      body: "By using this site and placing an order, you agree to our standard terms of sale: prices are listed in USD, orders are subject to availability, and all sales are final except as described in our Shipping & Returns policy.",
    },
    {
      slug: "the-atelier-notebook",
      type: "editorial",
      title: "The Atelier Notebook",
      body: "A running account of the small decisions behind every piece — the mills we visit, the samples that don't make the cut, and the details that do.",
      heroImageUrl: "https://placehold.co/1600x900/e7e4de/111111.png?text=Atelier+Notebook",
    },
    {
      slug: "autumn-editorial",
      type: "lookbook",
      title: "Autumn 2026",
      body: "Layered wool, quiet color, and the pieces that carry a wardrobe through the coldest months.\n\nShot on location, styled the way we'd actually wear it.",
      heroImageUrl: "https://placehold.co/1600x900/e7e4de/111111.png?text=Autumn+2026+Lookbook",
    },
  ];

  let created = 0;
  for (const page of pages) {
    const existing = await prisma.page.findUnique({ where: { slug: page.slug } });
    if (existing) continue;
    await prisma.page.create({
      data: {
        slug: page.slug,
        type: page.type,
        title: page.title,
        body: page.body,
        heroImageUrl: page.heroImageUrl ?? null,
        status: "published",
        publishedAt: new Date(),
      },
    });
    created++;
  }
  console.warn(
    `Seeded ${String(created)} new pages (${String(pages.length - created)} already existed).`,
  );

  const faqItems: { category: string; question: string; answer: string }[] = [
    {
      category: "Orders",
      question: "How do I track my order?",
      answer:
        "You'll receive a confirmation email with a tracking link once your order ships. You can also look it up any time from Order Tracking using your order number and email.",
    },
    {
      category: "Orders",
      question: "Can I change or cancel my order?",
      answer:
        "Contact us as soon as possible — we can usually accommodate changes before an order ships, but can't guarantee it once fulfillment has started.",
    },
    {
      category: "Shipping",
      question: "How long does shipping take?",
      answer:
        "Most orders arrive within 3-7 business days domestically, and 7-14 business days internationally.",
    },
    {
      category: "Shipping",
      question: "Do you ship internationally?",
      answer:
        "Yes, we ship worldwide. Duties and taxes for international orders are calculated at checkout.",
    },
    {
      category: "Returns",
      question: "What is your return policy?",
      answer:
        "Unworn items in original packaging can be returned within 30 days of delivery for a full refund to your original payment method.",
    },
    {
      category: "Sizing",
      question: "How do I find my size?",
      answer:
        "Check the Size Guide for general fit notes, or the size chart on each product page for precise measurements.",
    },
  ];

  let faqCreated = 0;
  for (let i = 0; i < faqItems.length; i++) {
    const item = faqItems[i];
    if (!item) continue;
    const existing = await prisma.faqItem.findFirst({ where: { question: item.question } });
    if (existing) continue;
    await prisma.faqItem.create({ data: { ...item, position: i } });
    faqCreated++;
  }
  console.warn(`Seeded ${String(faqCreated)} new FAQ items.`);

  const footerLinks: { section: string; label: string; href: string }[] = [
    { section: "Help", label: "Shipping & Returns", href: "/pages/shipping-returns" },
    { section: "Help", label: "Size Guide", href: "/pages/size-guide" },
    { section: "Help", label: "FAQ", href: "/faq" },
    { section: "Help", label: "Contact", href: "/pages/contact" },
    { section: "About", label: "Our Story", href: "/pages/our-story" },
    { section: "About", label: "Sustainability", href: "/pages/sustainability" },
    { section: "About", label: "Careers", href: "/pages/careers" },
    { section: "About", label: "Lookbooks", href: "/lookbooks" },
    { section: "Legal", label: "Privacy Policy", href: "/pages/privacy-policy" },
    { section: "Legal", label: "Terms of Service", href: "/pages/terms-of-service" },
  ];

  let linksCreated = 0;
  for (let i = 0; i < footerLinks.length; i++) {
    const link = footerLinks[i];
    if (!link) continue;
    const existing = await prisma.footerLink.findFirst({
      where: { section: link.section, label: link.label },
    });
    if (existing) continue;
    await prisma.footerLink.create({ data: { ...link, position: i } });
    linksCreated++;
  }
  console.warn(`Seeded ${String(linksCreated)} new footer links.`);
}
