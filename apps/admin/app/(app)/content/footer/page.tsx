"use client";

import { Button, Container, Input, Label, Section, toast } from "@silonya/ui";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ContentFooterPage() {
  const [showForm, setShowForm] = useState(false);
  const [section, setSection] = useState("");
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");

  const utils = trpc.useUtils();
  const query = trpc.adminCms.footerLinks.list.useQuery();
  const create = trpc.adminCms.footerLinks.create.useMutation({
    onSuccess: () => {
      void utils.adminCms.footerLinks.list.invalidate();
      setShowForm(false);
      setSection("");
      setLabel("");
      setHref("");
      toast({ title: "Link added" });
    },
  });
  const deleteLink = trpc.adminCms.footerLinks.delete.useMutation({
    onSuccess: () => {
      void utils.adminCms.footerLinks.list.invalidate();
    },
  });

  const grouped = new Map<string, typeof query.data>();
  for (const link of query.data ?? []) {
    grouped.set(link.section, [...(grouped.get(link.section) ?? []), link]);
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Footer links</h1>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancel" : "New link"}
          </Button>
        </div>
        <p className="text-stone mb-6 font-sans text-sm">
          A section named &quot;Legal&quot; renders as the footer&apos;s legal-links row instead of
          a regular column.
        </p>

        {showForm ? (
          <div className="border-mist mb-8 flex max-w-md flex-col gap-3 border p-4">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
              }}
              placeholder="Help"
            />
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
              }}
              placeholder="Shipping & Returns"
            />
            <Label htmlFor="href">Link</Label>
            <Input
              id="href"
              value={href}
              onChange={(e) => {
                setHref(e.target.value);
              }}
              placeholder="/pages/shipping-returns"
            />
            <Button
              disabled={create.isPending}
              onClick={() => {
                create.mutate({ section: section.trim(), label: label.trim(), href: href.trim() });
              }}
              className="w-fit"
            >
              {create.isPending ? "Adding…" : "Add link"}
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from(grouped.entries()).map(([sectionName, links]) => (
            <div key={sectionName}>
              <h2 className="font-display text-ink mb-3 text-lg">{sectionName}</h2>
              <ul className="flex flex-col gap-2">
                {links?.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink font-sans text-sm">{link.label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        deleteLink.mutate({ id: link.id });
                      }}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
