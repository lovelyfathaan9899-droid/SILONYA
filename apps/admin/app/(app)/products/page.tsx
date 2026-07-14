"use client";

import {
  Badge,
  Button,
  Container,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Input,
  Label,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import { Package, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type StatusFilter = "all" | "draft" | "active" | "archived";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePrice: number;
  currency: string;
  variantCount: number;
  totalStock: number;
}

function NewProductDialog() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const createProduct = trpc.adminCatalog.products.create.useMutation({
    onSuccess: async (product) => {
      setOpen(false);
      setName("");
      await utils.adminCatalog.products.list.invalidate();
      router.push(`/products/${product.id}`);
    },
    onError: (error) => {
      toast({ title: "Couldn't create product", description: error.message, variant: "error" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} strokeWidth={1.5} className="mr-2" aria-hidden="true" />
          New product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Starts as a draft — everything else (pricing, variants, media) is set on the next
            screen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-product-name">Name</Label>
          <Input
            id="new-product-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Wool Overcoat"
          />
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={name.trim().length === 0 || createProduct.isPending}
            onClick={() => {
              createProduct.mutate({ name: name.trim(), basePrice: 0 });
            }}
          >
            {createProduct.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  const query = trpc.adminCatalog.products.list.useInfiniteQuery(
    {
      limit: 20,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== "all" ? { status } : {}),
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const rows: ProductRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Products</h1>
          <NewProductDialog />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search products…"
            className="max-w-xs"
            aria-label="Search products"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isError ? (
          <ErrorState
            title="Couldn't load products"
            description={query.error.message}
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
        ) : (
          <DataTable<ProductRow>
            columns={[
              {
                key: "name",
                header: "Product",
                render: (row) => (
                  <Link
                    href={`/products/${row.id}`}
                    className="text-ink font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge
                    variant={
                      row.status === "active"
                        ? "success"
                        : row.status === "archived"
                          ? "default"
                          : "outline"
                    }
                  >
                    {row.status}
                  </Badge>
                ),
              },
              {
                key: "basePrice",
                header: "Price",
                render: (row) => formatPriceForDisplay(row.basePrice, row.currency),
              },
              { key: "variantCount", header: "Variants" },
              { key: "totalStock", header: "In stock" },
            ]}
            rows={rows}
            keyExtractor={(row) => row.id}
            isLoading={query.isLoading}
            emptyState={
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Create your first product to get started."
              />
            }
          />
        )}

        {query.hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                void query.fetchNextPage();
              }}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
