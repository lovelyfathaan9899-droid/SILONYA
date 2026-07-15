"use client";

import {
  Badge,
  Button,
  Container,
  DataTable,
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
} from "@silonya/ui";
import { Tag } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type DiscountType = "percentage" | "fixed_amount" | "free_shipping";

interface DiscountRow {
  id: string;
  code: string | null;
  type: DiscountType;
  value: number;
  usageLimit: number | null;
  _count: { redemptions: number; eligibility: number };
}

const emptyForm = {
  code: "",
  type: "percentage" as DiscountType,
  value: 10,
  usageLimit: "",
  perUserLimit: "",
  minimumSubtotal: "",
};

export default function DiscountsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const utils = trpc.useUtils();
  const query = trpc.adminDiscounts.list.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const createDiscount = trpc.adminDiscounts.create.useMutation({
    onSuccess: () => {
      void utils.adminDiscounts.list.invalidate();
      setShowForm(false);
      setForm(emptyForm);
    },
  });
  const deleteDiscount = trpc.adminDiscounts.delete.useMutation({
    onSuccess: () => {
      void utils.adminDiscounts.list.invalidate();
    },
  });

  const rows: DiscountRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  function handleCreate() {
    createDiscount.mutate({
      ...(form.code.trim() ? { code: form.code.trim() } : {}),
      type: form.type,
      value: form.type === "free_shipping" ? 0 : form.value,
      ...(form.usageLimit ? { usageLimit: Number(form.usageLimit) } : {}),
      ...(form.perUserLimit ? { perUserLimit: Number(form.perUserLimit) } : {}),
      ...(form.minimumSubtotal
        ? { minimumSubtotal: Math.round(Number(form.minimumSubtotal) * 100) }
        : {}),
      eligibleUserIds: [],
    });
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Coupons</h1>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancel" : "New coupon"}
          </Button>
        </div>

        {showForm ? (
          <div className="border-mist mb-8 flex max-w-lg flex-col gap-3 border p-4">
            <Label htmlFor="code">Code (leave blank for automatic discount)</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => {
                setForm({ ...form, code: e.target.value });
              }}
              placeholder="e.g. WELCOME10"
            />
            <Label htmlFor="type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(value) => {
                setForm({ ...form, type: value as DiscountType });
              }}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed_amount">Fixed amount (cents)</SelectItem>
                <SelectItem value="free_shipping">Free shipping</SelectItem>
              </SelectContent>
            </Select>
            {form.type !== "free_shipping" ? (
              <>
                <Label htmlFor="value">
                  Value {form.type === "percentage" ? "(%)" : "(cents)"}
                </Label>
                <Input
                  id="value"
                  type="number"
                  value={form.value}
                  onChange={(e) => {
                    setForm({ ...form, value: Number(e.target.value) });
                  }}
                />
              </>
            ) : null}
            <Label htmlFor="usageLimit">Total usage limit (optional)</Label>
            <Input
              id="usageLimit"
              type="number"
              value={form.usageLimit}
              onChange={(e) => {
                setForm({ ...form, usageLimit: e.target.value });
              }}
            />
            <Label htmlFor="perUserLimit">Per-customer limit (optional)</Label>
            <Input
              id="perUserLimit"
              type="number"
              value={form.perUserLimit}
              onChange={(e) => {
                setForm({ ...form, perUserLimit: e.target.value });
              }}
            />
            <Label htmlFor="minimumSubtotal">Minimum subtotal (optional, dollars)</Label>
            <Input
              id="minimumSubtotal"
              type="number"
              value={form.minimumSubtotal}
              onChange={(e) => {
                setForm({ ...form, minimumSubtotal: e.target.value });
              }}
            />
            <Button disabled={createDiscount.isPending} onClick={handleCreate} className="w-fit">
              {createDiscount.isPending ? "Creating…" : "Create coupon"}
            </Button>
          </div>
        ) : null}

        {query.isError ? (
          <ErrorState title="Couldn't load coupons" description={query.error.message} />
        ) : (
          <DataTable<DiscountRow>
            columns={[
              {
                key: "code",
                header: "Code",
                render: (row) => row.code ?? <Badge variant="accent">Automatic</Badge>,
              },
              { key: "type", header: "Type" },
              {
                key: "value",
                header: "Value",
                render: (row) =>
                  row.type === "percentage"
                    ? `${String(row.value)}%`
                    : row.type === "fixed_amount"
                      ? `${String(row.value)}¢`
                      : "—",
              },
              {
                key: "usageLimit",
                header: "Redemptions",
                render: (row) =>
                  `${String(row._count.redemptions)}${row.usageLimit ? ` / ${String(row.usageLimit)}` : ""}`,
              },
              {
                key: "id",
                header: "",
                render: (row) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      deleteDiscount.mutate({ id: row.id });
                    }}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
            rows={rows}
            keyExtractor={(row) => row.id}
            isLoading={query.isLoading}
            emptyState={
              <EmptyState
                icon={Tag}
                title="No coupons"
                description="Create your first coupon above."
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
