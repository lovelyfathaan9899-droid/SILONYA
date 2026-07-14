"use client";

import {
  Badge,
  Breadcrumbs,
  Button,
  Container,
  ErrorState,
  LoadingState,
  Section,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@silonya/ui";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DetailsTab } from "./DetailsTab";
import { InventoryTab } from "./InventoryTab";
import { MediaTab } from "./MediaTab";
import { OptionsTab } from "./OptionsTab";
import { VariantsTab } from "./VariantsTab";

export function ProductEditor({ productId }: { productId: string }) {
  const utils = trpc.useUtils();
  const query = trpc.adminCatalog.products.get.useQuery({ id: productId });

  const publish = trpc.adminCatalog.products.publish.useMutation({
    onSuccess: async () => {
      toast({ title: "Product published", variant: "success" });
      await utils.adminCatalog.products.get.invalidate({ id: productId });
    },
    onError: (error) => {
      toast({ title: "Couldn't publish", description: error.message, variant: "error" });
    },
  });

  const archive = trpc.adminCatalog.products.archive.useMutation({
    onSuccess: async () => {
      toast({ title: "Product archived" });
      await utils.adminCatalog.products.get.invalidate({ id: productId });
    },
    onError: (error) => {
      toast({ title: "Couldn't archive", description: error.message, variant: "error" });
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
          <div className="flex gap-3">
            {product.status !== "archived" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  archive.mutate({ id: productId });
                }}
              >
                Archive
              </Button>
            ) : null}
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
          </div>
        </div>

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
