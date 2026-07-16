"use client";

import { Button, Container, Input, Label, Section, Textarea, toast } from "@silonya/ui";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ContentFaqPage() {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const utils = trpc.useUtils();
  const query = trpc.adminCms.faq.list.useQuery();
  const create = trpc.adminCms.faq.create.useMutation({
    onSuccess: () => {
      void utils.adminCms.faq.list.invalidate();
      setShowForm(false);
      setCategory("");
      setQuestion("");
      setAnswer("");
      toast({ title: "Question added" });
    },
  });
  const update = trpc.adminCms.faq.update.useMutation({
    onSuccess: () => {
      void utils.adminCms.faq.list.invalidate();
    },
  });
  const deleteItem = trpc.adminCms.faq.delete.useMutation({
    onSuccess: () => {
      void utils.adminCms.faq.list.invalidate();
    },
  });

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">FAQ</h1>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancel" : "New question"}
          </Button>
        </div>

        {showForm ? (
          <div className="border-mist mb-8 flex max-w-lg flex-col gap-3 border p-4">
            <Label htmlFor="category">Category (optional)</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
              }}
              placeholder="Shipping"
            />
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
              }}
            />
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
              }}
              rows={4}
            />
            <Button
              disabled={create.isPending}
              onClick={() => {
                create.mutate({
                  question: question.trim(),
                  answer: answer.trim(),
                  ...(category.trim() ? { category: category.trim() } : {}),
                });
              }}
              className="w-fit"
            >
              {create.isPending ? "Adding…" : "Add question"}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {query.data?.map((item) => (
            <div
              key={item.id}
              className="border-mist flex items-start justify-between gap-4 border p-4"
            >
              <div>
                <p className="text-stone font-sans text-xs uppercase tracking-wide">
                  {item.category ?? "General"}
                </p>
                <p className="text-ink mt-1 font-sans text-sm font-medium">{item.question}</p>
                <p className="text-stone mt-1 font-sans text-sm">{item.answer}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    update.mutate({ id: item.id, isActive: !item.isActive });
                  }}
                >
                  {item.isActive ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    deleteItem.mutate({ id: item.id });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
