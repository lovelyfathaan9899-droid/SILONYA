"use client";

import {
  Badge,
  Button,
  Container,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type StatusFilter =
  | "all"
  | "pending_payment"
  | "payment_failed"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded"
  | "partially_refunded";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
];

const STATUS_BADGE_VARIANT: Record<string, "default" | "outline" | "accent" | "success" | "error"> =
  {
    pending_payment: "outline",
    payment_failed: "error",
    paid: "accent",
    processing: "outline",
    shipped: "accent",
    delivered: "success",
    cancelled: "default",
    returned: "outline",
    refunded: "default",
    partially_refunded: "default",
  };

interface OrderRow {
  id: string;
  orderNumber: string;
  guestEmail: string | null;
  status: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  createdAt: Date;
}

export default function OrdersPage() {
  const router = useRouter();
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

  const query = trpc.adminOrders.list.useInfiniteQuery(
    {
      limit: 20,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== "all" ? { status } : {}),
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const rows: OrderRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Orders</h1>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search order number or email…"
            className="max-w-xs"
            aria-label="Search orders"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {query.isError ? (
          <ErrorState
            title="Couldn't load orders"
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
          <DataTable<OrderRow>
            columns={[
              {
                key: "orderNumber",
                header: "Order",
                render: (row) => (
                  <Link href={`/orders/${row.id}`} className="text-ink font-medium hover:underline">
                    {row.orderNumber}
                  </Link>
                ),
              },
              { key: "guestEmail", header: "Customer", render: (row) => row.guestEmail ?? "—" },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge variant={STATUS_BADGE_VARIANT[row.status] ?? "default"}>
                    {row.status.replace(/_/g, " ")}
                  </Badge>
                ),
              },
              {
                key: "grandTotal",
                header: "Total",
                render: (row) => formatPriceForDisplay(row.grandTotal, row.currency),
              },
              { key: "itemCount", header: "Items" },
              {
                key: "createdAt",
                header: "Placed",
                render: (row) => new Date(row.createdAt).toLocaleDateString(),
              },
            ]}
            rows={rows}
            keyExtractor={(row) => row.id}
            isLoading={query.isLoading}
            onRowClick={(row) => {
              router.push(`/orders/${row.id}`);
            }}
            emptyState={
              <EmptyState
                icon={ShoppingBag}
                title="No orders yet"
                description="Orders will appear here once customers start checking out."
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
