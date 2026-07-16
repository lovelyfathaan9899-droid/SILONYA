"use client";

import {
  Badge,
  Button,
  Container,
  ErrorState,
  Input,
  Label,
  Section,
  Spinner,
  Textarea,
  toast,
} from "@silonya/ui";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function EditContentPagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const query = trpc.adminCms.pages.get.useQuery({ id: params.id });

  const [title, setTitle] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [body, setBody] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !query.data) return;
    setTitle(query.data.title);
    setHeroImageUrl(query.data.heroImageUrl ?? "");
    setBody(query.data.body);
    setSeoTitle(query.data.seoTitle ?? "");
    setSeoDescription(query.data.seoDescription ?? "");
    setLoaded(true);
  }, [query.data, loaded]);

  const update = trpc.adminCms.pages.update.useMutation({
    onSuccess: () => {
      void utils.adminCms.pages.get.invalidate({ id: params.id });
      toast({ title: "Saved" });
    },
  });
  const setStatus = trpc.adminCms.pages.setStatus.useMutation({
    onSuccess: () => {
      void utils.adminCms.pages.get.invalidate({ id: params.id });
      void utils.adminCms.pages.list.invalidate();
    },
  });
  const deletePage = trpc.adminCms.pages.delete.useMutation({
    onSuccess: () => {
      void utils.adminCms.pages.list.invalidate();
      router.push("/content/pages");
    },
  });

  if (query.isError) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <ErrorState title="Couldn't load page" description={query.error.message} />
        </Container>
      </Section>
    );
  }

  if (query.isLoading || !query.data) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <Spinner />
        </Container>
      </Section>
    );
  }

  const page = query.data;

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-ink text-2xl">{page.title}</h1>
            <p className="text-stone font-sans text-sm">
              /{page.slug} · {page.type}
            </p>
          </div>
          <Badge variant={page.status === "published" ? "success" : "outline"}>{page.status}</Badge>
        </div>

        <div className="flex max-w-lg flex-col gap-3">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
          <Label htmlFor="heroImageUrl">Hero image URL</Label>
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
            rows={8}
          />
          <Label htmlFor="seoTitle">SEO title</Label>
          <Input
            id="seoTitle"
            value={seoTitle}
            onChange={(e) => {
              setSeoTitle(e.target.value);
            }}
          />
          <Label htmlFor="seoDescription">SEO description</Label>
          <Textarea
            id="seoDescription"
            value={seoDescription}
            onChange={(e) => {
              setSeoDescription(e.target.value);
            }}
            rows={2}
          />

          <div className="mt-2 flex flex-wrap gap-3">
            <Button
              disabled={update.isPending}
              onClick={() => {
                update.mutate({
                  id: page.id,
                  title: title.trim(),
                  body: body.trim(),
                  heroImageUrl: heroImageUrl.trim() || undefined,
                  seoTitle: seoTitle.trim() || undefined,
                  seoDescription: seoDescription.trim() || undefined,
                });
              }}
            >
              Save
            </Button>
            {page.status === "draft" ? (
              <Button
                variant="secondary"
                disabled={setStatus.isPending}
                onClick={() => {
                  setStatus.mutate({ id: page.id, status: "published" });
                }}
              >
                Publish
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={setStatus.isPending}
                onClick={() => {
                  setStatus.mutate({ id: page.id, status: "draft" });
                }}
              >
                Unpublish
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={deletePage.isPending}
              onClick={() => {
                deletePage.mutate({ id: page.id });
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
