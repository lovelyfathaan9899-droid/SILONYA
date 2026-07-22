import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  EmptyState,
  Section,
} from "@silonya/ui";
import { createServerCaller } from "@/lib/trpc-caller";
import { toJsonLdString } from "@/lib/json-ld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about orders, shipping, returns, and sizing at SILONYA.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const caller = createServerCaller();
  const categories = await caller.cms.faq();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: categories.flatMap((category) =>
      category.questions.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    ),
  };

  return (
    <Section spacing="lg">
      {categories.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdString(faqJsonLd) }}
        />
      ) : null}
      <h1 className="font-display text-ink mb-8 text-3xl md:text-4xl">
        Frequently Asked Questions
      </h1>
      {categories.length === 0 ? (
        <EmptyState title="No questions yet" description="Check back soon." />
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-10">
          {categories.map((category) => (
            <div key={category.category}>
              <h2 className="font-display text-ink mb-3 text-xl">{category.category}</h2>
              <Accordion type="single" collapsible>
                {category.questions.map((q, i) => (
                  <AccordionItem key={i} value={`${category.category}-${String(i)}`}>
                    <AccordionTrigger>{q.question}</AccordionTrigger>
                    <AccordionContent>{q.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
