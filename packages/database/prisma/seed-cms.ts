import type { PrismaClient } from "@prisma/client";

/**
 * Sample CMS content (Phase 10 — SEARCH, CMS & ANALYTICS) so the homepage's
 * hero/promo/editorial sections, footer, and a handful of real static pages
 * exist from a fresh seed — replacing the lib/homepage-content.ts and
 * lib/nav-data.ts hardcoded "#" placeholders that predate this phase.
 * Idempotent — safe to re-run. No lookbook pages are seeded here (Pakistan
 * launch removed the demo lookbook content, apps/web/app/lookbooks/**) —
 * the "lookbook" Page type/admin management UI still exists for later use.
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
    create: { type: "promo_banner", body: "Free standard delivery on orders over PKR 5,000." },
  });

  await prisma.contentBlock.upsert({
    where: { type: "editorial" },
    update: {},
    create: {
      type: "editorial",
      eyebrow: "The Edit",
      heading: "Considered, not trend-driven",
      body: "Every SILONYA piece is chosen for how it wears in over time — quality cloth and quiet construction, not just how it photographs on day one.",
      imageUrl: "https://placehold.co/1200x1500/e7e4de/111111.png?text=SILONYA+Journal",
      imageAlt: "SILONYA editorial photograph",
      ctaLabel: "Shop the Essentials",
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
      slug: "shipping-policy",
      type: "static_page",
      title: "Shipping Policy",
      body: "We currently ship within Pakistan. Standard Delivery takes 2-5 business days; Express Delivery takes 1-2 business days. Free Standard Delivery applies on orders over PKR 5,000; otherwise a flat delivery fee applies at checkout.\n\nCash on Delivery is available on every order. Online payment is coming soon.",
    },
    {
      slug: "return-policy",
      type: "static_page",
      title: "Return Policy",
      body: "Returns are accepted within 7 days of delivery, provided the item is unworn, unwashed, and in its original packaging with tags attached.\n\nTo start a return, contact us with your order number. Once the return is received and inspected, a refund or exchange is issued.",
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
      slug: "about",
      type: "static_page",
      title: "About",
      body: "SILONYA is a fashion label built on considered pieces made to be worn for years, not seasons — quality cloth and quiet construction over trend.\n\nFor order support or any other questions, reach us at hello@silonya.com.",
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
      body: "By using this site and placing an order, you agree to our standard terms of sale: prices are listed in Pakistani Rupees (PKR), orders are subject to availability, and all sales are final except as described in our Return Policy. Cash on Delivery is available on every order; online payment is coming soon.",
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
      question: "How long does delivery take?",
      answer:
        "Standard Delivery takes 2-5 business days; Express Delivery takes 1-2 business days, both within Pakistan.",
    },
    {
      category: "Payment",
      question: "How can I pay?",
      answer: "Cash on Delivery is available on every order. Online payment is coming soon.",
    },
    {
      category: "Returns",
      question: "What is your return policy?",
      answer:
        "Unworn, unwashed items in original packaging with tags attached can be returned within 7 days of delivery for a refund or exchange.",
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
    { section: "Company", label: "About", href: "/pages/about" },
    { section: "Company", label: "Contact", href: "/pages/contact" },
    { section: "Policies", label: "Shipping Policy", href: "/pages/shipping-policy" },
    { section: "Policies", label: "Return Policy", href: "/pages/return-policy" },
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
