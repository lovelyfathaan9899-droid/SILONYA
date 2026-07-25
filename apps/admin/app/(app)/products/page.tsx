"use client";

import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Copy, ExternalLink, MoreVertical, Package, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatPKR } from "@/lib/currency";
import { trpc } from "@/lib/trpc";

type StatusFilter = "all" | "draft" | "active" | "archived";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePrice: number;
  currency: string;
  thumbnailUrl: string | null;
  categoryName: string | null;
  variantCount: number;
  primarySku: string | null;
  totalStock: number;
  totalReserved: number;
  createdAt: Date;
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

function RowActions({ row }: { row: ProductRow }) {
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const invalidate = () => utils.adminCatalog.products.list.invalidate();

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
  const archive = trpc.adminCatalog.products.archive.useMutation({
    onSuccess: async () => {
      toast({ title: "Product archived" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't archive", description: error.message, variant: "error" });
    },
  });
  const duplicate = trpc.adminCatalog.products.duplicate.useMutation({
    onSuccess: async () => {
      toast({ title: "Product duplicated", variant: "success" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't duplicate", description: error.message, variant: "error" });
    },
  });
  const softDelete = trpc.adminCatalog.products.softDelete.useMutation({
    onSuccess: async () => {
      toast({ title: "Product deleted" });
      setDeleteOpen(false);
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't delete", description: error.message, variant: "error" });
    },
  });
  const restore = trpc.adminCatalog.products.restore.useMutation({
    onSuccess: async () => {
      toast({ title: "Product restored", variant: "success" });
      await invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't restore", description: error.message, variant: "error" });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Actions for ${row.name}`}>
            <MoreVertical size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/products/${row.id}`}>Edit</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/products/${row.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
              Preview
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              duplicate.mutate({ id: row.id });
            }}
          >
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
            Duplicate
          </DropdownMenuItem>
          {row.status === "archived" ? (
            <DropdownMenuItem
              onClick={() => {
                activate.mutate({ id: row.id });
              }}
            >
              Activate
            </DropdownMenuItem>
          ) : null}
          {row.status === "active" ? (
            <DropdownMenuItem
              onClick={() => {
                deactivate.mutate({ id: row.id });
              }}
            >
              Deactivate
            </DropdownMenuItem>
          ) : null}
          {row.status !== "archived" ? (
            <DropdownMenuItem
              onClick={() => {
                archive.mutate({ id: row.id });
              }}
            >
              Archive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                restore.mutate({ id: row.id });
              }}
            >
              <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
              Restore
            </DropdownMenuItem>
          )}
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this product?"
        description={`This removes "${row.name}" from the storefront and admin listings. It can be restored later from a deleted product's row.`}
        confirmLabel="Delete product"
        isPending={softDelete.isPending}
        requireTypedWord="DELETE"
        onConfirm={() => {
          softDelete.mutate({ id: row.id });
        }}
      />
    </>
  );
}

/**
 * Bulk actions reuse the same single-id mutations as the row-level menu
 * (there's no dedicated bulk endpoint) — each selected id is mutated in
 * parallel via mutateAsync, which keeps the existing per-item audit log
 * entries intact rather than requiring a new bulk-specific audit shape.
 */
function BulkActionBar({ selectedIds, onClear }: { selectedIds: string[]; onClear: () => void }) {
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "activate" | "deactivate" | "archive" | "delete" | null
  >(null);
  const invalidate = () => utils.adminCatalog.products.list.invalidate();

  const activate = trpc.adminCatalog.products.activate.useMutation();
  const deactivate = trpc.adminCatalog.products.deactivate.useMutation();
  const archive = trpc.adminCatalog.products.archive.useMutation();
  const softDelete = trpc.adminCatalog.products.softDelete.useMutation();

  async function runBulk(action: "activate" | "deactivate" | "archive" | "delete") {
    setPendingAction(action);
    const mutation =
      action === "activate"
        ? activate
        : action === "deactivate"
          ? deactivate
          : action === "archive"
            ? archive
            : softDelete;

    const results = await Promise.allSettled(selectedIds.map((id) => mutation.mutateAsync({ id })));
    const failed = results.filter((r) => r.status === "rejected").length;

    await invalidate();
    setPendingAction(null);
    setDeleteOpen(false);
    onClear();

    if (failed > 0) {
      toast({
        title: `${String(failed)} of ${String(selectedIds.length)} failed`,
        variant: "error",
      });
    } else {
      toast({ title: `${String(selectedIds.length)} product(s) updated`, variant: "success" });
    }
  }

  return (
    <>
      <div className="bg-ink mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-bone font-sans text-sm">{selectedIds.length} selected</span>
        <Button
          variant="secondary"
          size="sm"
          className="border-bone text-bone hover:bg-bone/10"
          disabled={pendingAction !== null}
          onClick={() => {
            void runBulk("activate");
          }}
        >
          {pendingAction === "activate" ? "Activating…" : "Activate"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-bone text-bone hover:bg-bone/10"
          disabled={pendingAction !== null}
          onClick={() => {
            void runBulk("deactivate");
          }}
        >
          {pendingAction === "deactivate" ? "Deactivating…" : "Deactivate"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-bone text-bone hover:bg-bone/10"
          disabled={pendingAction !== null}
          onClick={() => {
            void runBulk("archive");
          }}
        >
          {pendingAction === "archive" ? "Archiving…" : "Archive"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-bone text-bone hover:bg-bone/10"
          disabled={pendingAction !== null}
          onClick={() => {
            setDeleteOpen(true);
          }}
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-bone hover:bg-bone/10 ml-auto"
          onClick={onClear}
        >
          Clear selection
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${String(selectedIds.length)} product(s)?`}
        description="This removes them from the storefront and admin listings. They can be restored later from the deleted-products view."
        confirmLabel="Delete products"
        isPending={pendingAction === "delete"}
        requireTypedWord="DELETE"
        onConfirm={() => {
          void runBulk("delete");
        }}
      />
    </>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      deletedOnly: showDeleted,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== "all" && !showDeleted ? { status } : {}),
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const rows: ProductRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  const allLoadedSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, status, showDeleted]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Products</h1>
          <NewProductDialog />
        </div>

        {selectedIds.size > 0 ? (
          <BulkActionBar
            selectedIds={Array.from(selectedIds)}
            onClear={() => {
              setSelectedIds(new Set());
            }}
          />
        ) : null}

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
            <SelectTrigger className="w-40" aria-label="Filter by status" disabled={showDeleted}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showDeleted ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setShowDeleted((prev) => !prev);
            }}
          >
            {showDeleted ? "Showing deleted" : "Show deleted"}
          </Button>
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
                key: "id",
                id: "select",
                header: (
                  <Checkbox
                    checked={allLoadedSelected}
                    aria-label="Select all loaded products"
                    onCheckedChange={() => {
                      setSelectedIds(
                        allLoadedSelected ? new Set() : new Set(rows.map((r) => r.id)),
                      );
                    }}
                  />
                ),
                render: (row) => (
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    aria-label={`Select ${row.name}`}
                    onCheckedChange={() => {
                      toggleRow(row.id);
                    }}
                  />
                ),
                className: "w-10",
              },
              {
                key: "thumbnailUrl",
                header: "",
                render: (row) =>
                  row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local static asset
                    <img src={row.thumbnailUrl} alt="" className="bg-mist h-12 w-10 object-cover" />
                  ) : (
                    <div className="bg-mist h-12 w-10" aria-hidden="true" />
                  ),
                className: "w-16",
              },
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
                key: "primarySku",
                header: "SKU",
                render: (row) => (
                  <span className="text-stone font-sans text-xs">
                    {row.primarySku ?? (row.variantCount > 1 ? "Multiple" : "—")}
                  </span>
                ),
              },
              {
                key: "categoryName",
                header: "Category",
                render: (row) => row.categoryName ?? "—",
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
                render: (row) => formatPKR(row.basePrice),
              },
              {
                key: "totalStock",
                header: "Stock (avail.)",
                render: (row) => Math.max(row.totalStock - row.totalReserved, 0),
              },
              {
                key: "createdAt",
                header: "Created",
                render: (row) => new Date(row.createdAt).toLocaleDateString("en-US"),
              },
              {
                key: "id",
                header: "",
                id: "actions",
                render: (row) => <RowActions row={row} />,
                className: "w-12",
              },
            ]}
            rows={rows}
            keyExtractor={(row) => row.id}
            isLoading={query.isLoading}
            emptyState={
              showDeleted ? (
                <EmptyState
                  icon={Trash2}
                  title="No deleted products"
                  description="Products you delete show up here until restored."
                />
              ) : (
                <EmptyState
                  icon={Package}
                  title="No products yet"
                  description="Create your first product to get started."
                />
              )
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
