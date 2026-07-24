"use client";

import {
  Badge,
  Breadcrumbs,
  Button,
  ConfirmDialog,
  Container,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  LoadingState,
  Section,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@silonya/ui";
import { Copy, ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DetailsTab } from "./DetailsTab";
import { InventoryTab } from "./InventoryTab";
import { MediaTab } from "./MediaTab";
import { OptionsTab } from "./OptionsTab";
import { VariantsTab } from "./VariantsTab";

export function ProductEditor({ productId }: { productId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const query = trpc.adminCatalog.products.get.useQuery({ id: productId });

  const invalidate = () => utils.adminCatalog.products.get.invalidate({ id: productId });

  const publish = trpc.adminCatalog.products.publish.useMutation({
    onSuccess: async () => {
      toast({ title: "Product published", variant: "success" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't publish", description: error.message, variant: "error" });
    },
  });

  const archive = trpc.adminCatalog.products.archive.useMutation({
    onSuccess: async () => {
      toast({ title: "Product archived" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't archive", description: error.message, variant: "error" });
    },
  });

  const activate = trpc.adminCatalog.products.activate.useMutation({
    onSuccess: async () => {
      toast({ title: "Product activated", variant: "success" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't activate", description: error.message, variant: "error" });
    },
  });

  const deactivate = trpc.adminCatalog.products.deactivate.useMutation({
    onSuccess: async () => {
      toast({ title: "Product deactivated" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't deactivate", description: error.message, variant: "error" });
    },
  });

  const duplicate = trpc.adminCatalog.products.duplicate.useMutation({
    onSuccess: async (cloned) => {
      toast({ title: "Product duplicated", variant: "success" });
      await utils.adminCatalog.products.list.invalidate();
      router.push(`/products/${cloned.id}`);
    },
    onError: (error) => {
      toast({ title: "Couldn't duplicate", description: error.message, variant: "error" });
    },
  });

  const softDelete = trpc.adminCatalog.products.softDelete.useMutation({
    onSuccess: async () => {
      toast({ title: "Product deleted" });
      setDeleteOpen(false);
      await utils.adminCatalog.products.list.invalidate();
      router.push("/products");
    },
    onError: (error) => {
      toast({ title: "Couldn't delete", description: error.message, variant: "error" });
    },
  });

  if (query.isLoading) {
    return <LoadingState label="Loading product" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Couldn't load this product"
        description={query.error?.message}
        action={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  const product = query.data;

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <Breadcrumbs
          linkAs={Link}
          items={[{ label: "Products", href: "/products" }, { label: product.name }]}
          className="mb-4"
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-ink text-2xl">{product.name}</h1>
            <Badge
              variant={
                product.status === "active"
                  ? "success"
                  : product.status === "archived"
                    ? "default"
                    : "outline"
              }
            >
              {product.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {product.status === "draft" ? (
              <Button
                onClick={() => {
                  publish.mutate({ id: productId });
                }}
                disabled={publish.isPending}
              >
                {publish.isPending ? "Publishing…" : "Publish"}
              </Button>
            ) : null}
            {product.status === "archived" ? (
              <Button
                onClick={() => {
                  activate.mutate({ id: productId });
                }}
                disabled={activate.isPending}
              >
                {activate.isPending ? "Activating…" : "Activate"}
              </Button>
            ) : null}
            {product.status === "active" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  deactivate.mutate({ id: productId });
                }}
                disabled={deactivate.isPending}
              >
                {deactivate.isPending ? "Deactivating…" : "Deactivate"}
              </Button>
            ) : null}
            {product.status !== "archived" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  archive.mutate({ id: productId });
                }}
                disabled={archive.isPending}
              >
                Archive
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="md" aria-label="More actions">
                  <MoreVertical size={18} strokeWidth={1.5} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a
                    href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/products/${product.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
                    Preview on storefront
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    duplicate.mutate({ id: productId });
                  }}
                >
                  <Copy size={14} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-error"
                  onClick={() => {
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this product?"
          description={`This removes "${product.name}" from the storefront and admin listings. It isn't gone forever — Products can be restored from the deleted-items filter.`}
          confirmLabel="Delete product"
          isPending={softDelete.isPending}
          requireTypedWord="DELETE"
          onConfirm={() => {
            softDelete.mutate({ id: productId });
          }}
        />

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
            <TabsTrigger value="variants">Variants</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <DetailsTab product={product} />
          </TabsContent>
          <TabsContent value="options">
            <OptionsTab product={product} />
          </TabsContent>
          <TabsContent value="variants">
            <VariantsTab product={product} />
          </TabsContent>
          <TabsContent value="media">
            <MediaTab product={product} />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab product={product} />
          </TabsContent>
        </Tabs>
      </Container>
    </Section>
  );
}
