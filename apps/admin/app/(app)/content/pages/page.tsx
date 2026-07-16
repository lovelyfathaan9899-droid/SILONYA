"use client";

import {
  Badge,
  Button,
  Container,
  Input,
  Label,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@silonya/ui";
import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type PageType = "editorial" | "lookbook" | "static_page";

export default function ContentPagesPage() {
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<PageType>("static_page");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");

  const utils = trpc.useUtils();
  const query = trpc.adminCms.pages.list.useQuery({});
  const create = trpc.adminCms.pages.create.useMutation({
    onSuccess: () => {
      void utils.adminCms.pages.list.invalidate();
      setShowForm(false);
      setSlug("");
      setTitle("");
      setBody("");
      setHeroImageUrl("");
      toast({ title: "Page created" });
    },
    onError: (err) => {
      toast({ title: "Couldn't create page", description: err.message, variant: "error" });
    },
  });

  function handleCreate() {
    create.mutate({
      slug: slug.trim(),
      type,
      title: title.trim(),
      body: body.trim(),
      ...(heroImageUrl.trim() ? { heroImageUrl: heroImageUrl.trim() } : {}),
    });
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Pages</h1>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancel" : "New page"}
          </Button>
        </div>

        {showForm ? (
          <div className="border-mist mb-8 flex max-w-lg flex-col gap-3 border p-4">
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as PageType);
              }}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static_page">Static page</SelectItem>
                <SelectItem value="editorial">Editorial</SelectItem>
                <SelectItem value="lookbook">Lookbook</SelectItem>
              </SelectContent>
            </Select>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
              }}
              placeholder="shipping-returns"
            />
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
            <Label htmlFor="heroImageUrl">Hero image URL (optional)</Label>
            <Input
              id="heroImageUrl"
              value={heroImageUrl}
              onChange={(e) => {
                setHeroImageUrl(e.target.value);
              }}
            />
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
              }}
              rows={6}
            />
            <Button disabled={create.isPending} onClick={handleCreate} className="w-fit">
              {create.isPending ? "Creating…" : "Create page"}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {query.data?.map((page) => (
            <Link
              key={page.id}
              href={`/content/pages/${page.id}`}
              className="border-mist hover:border-ink flex items-center justify-between border p-3"
            >
              <div>
                <p className="text-ink font-sans text-sm font-medium">{page.title}</p>
                <p className="text-stone font-sans text-xs">
                  /{page.slug} · {page.type}
                </p>
              </div>
              <Badge variant={page.status === "published" ? "success" : "outline"}>
                {page.status}
              </Badge>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}
