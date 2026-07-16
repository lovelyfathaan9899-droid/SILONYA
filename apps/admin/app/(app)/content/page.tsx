"use client";

import { Button, Checkbox, Container, Input, Label, Section, Textarea, toast } from "@silonya/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type BlockType = "hero" | "promo_banner" | "editorial";

interface BlockForm {
  eyebrow: string;
  heading: string;
  subheading: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
}

const emptyForm: BlockForm = {
  eyebrow: "",
  heading: "",
  subheading: "",
  body: "",
  imageUrl: "",
  imageAlt: "",
  ctaLabel: "",
  ctaHref: "",
  isActive: true,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Homepage hero",
  promo_banner: "Promo banner",
  editorial: "Editorial section",
};

function BlockEditor({ type }: { type: BlockType }) {
  const utils = trpc.useUtils();
  const query = trpc.adminCms.contentBlocks.list.useQuery();
  const upsert = trpc.adminCms.contentBlocks.upsert.useMutation({
    onSuccess: () => {
      void utils.adminCms.contentBlocks.list.invalidate();
      toast({ title: "Saved" });
    },
    onError: () => {
      toast({ title: "Couldn't save", variant: "error" });
    },
  });

  const [form, setForm] = useState<BlockForm>(emptyForm);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !query.data) return;
    const existing = query.data.find((b) => b.type === type);
    if (existing) {
      setForm({
        eyebrow: existing.eyebrow ?? "",
        heading: existing.heading ?? "",
        subheading: existing.subheading ?? "",
        body: existing.body ?? "",
        imageUrl: existing.imageUrl ?? "",
        imageAlt: existing.imageAlt ?? "",
        ctaLabel: existing.ctaLabel ?? "",
        ctaHref: existing.ctaHref ?? "",
        isActive: existing.isActive,
      });
    }
    setLoaded(true);
  }, [query.data, loaded, type]);

  function field(key: keyof Omit<BlockForm, "isActive">) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [key]: e.target.value });
      },
    };
  }

  function handleSave() {
    upsert.mutate({
      type,
      isActive: form.isActive,
      ...(form.eyebrow.trim() ? { eyebrow: form.eyebrow.trim() } : {}),
      ...(form.heading.trim() ? { heading: form.heading.trim() } : {}),
      ...(form.subheading.trim() ? { subheading: form.subheading.trim() } : {}),
      ...(form.body.trim() ? { body: form.body.trim() } : {}),
      ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      ...(form.imageAlt.trim() ? { imageAlt: form.imageAlt.trim() } : {}),
      ...(form.ctaLabel.trim() ? { ctaLabel: form.ctaLabel.trim() } : {}),
      ...(form.ctaHref.trim() ? { ctaHref: form.ctaHref.trim() } : {}),
    });
  }

  return (
    <div className="border-mist flex flex-col gap-3 border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-ink text-lg">{BLOCK_LABELS[type]}</h2>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${type}-active`}
            checked={form.isActive}
            onCheckedChange={(checked) => {
              setForm({ ...form, isActive: checked === true });
            }}
          />
          <Label htmlFor={`${type}-active`}>Active</Label>
        </div>
      </div>

      {type !== "promo_banner" ? (
        <>
          <Label>Eyebrow</Label>
          <Input {...field("eyebrow")} />
          <Label>Heading</Label>
          <Input {...field("heading")} />
          <Label>Subheading</Label>
          <Input {...field("subheading")} />
          <Label>Image URL</Label>
          <Input {...field("imageUrl")} placeholder="https://…" />
          <Label>Image alt text</Label>
          <Input {...field("imageAlt")} />
        </>
      ) : null}

      <Label>{type === "promo_banner" ? "Message" : "Body"}</Label>
      <Textarea {...field("body")} rows={type === "promo_banner" ? 2 : 4} />

      {type !== "promo_banner" ? (
        <>
          <Label>CTA label</Label>
          <Input {...field("ctaLabel")} />
          <Label>CTA link</Label>
          <Input {...field("ctaHref")} placeholder="/collections/new-arrivals" />
        </>
      ) : null}

      <Button disabled={upsert.isPending} onClick={handleSave} className="w-fit">
        {upsert.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

export default function ContentPage() {
  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Content</h1>
          <div className="flex gap-4">
            <Link href="/content/pages" className="text-ink font-sans text-sm underline">
              Pages
            </Link>
            <Link href="/content/faq" className="text-ink font-sans text-sm underline">
              FAQ
            </Link>
            <Link href="/content/footer" className="text-ink font-sans text-sm underline">
              Footer
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <BlockEditor type="hero" />
          <BlockEditor type="promo_banner" />
          <BlockEditor type="editorial" />
        </div>
      </Container>
    </Section>
  );
}
