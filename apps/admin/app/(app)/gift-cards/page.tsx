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
} from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import { Gift } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface GiftCardRow {
  id: string;
  code: string;
  currentBalance: number;
  initialBalance: number;
  currency: string;
  issuedToEmail: string | null;
  isActive: boolean;
}

export default function GiftCardsPage() {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("50");
  const [email, setEmail] = useState("");

  const utils = trpc.useUtils();
  const query = trpc.adminGiftCards.list.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const issue = trpc.adminGiftCards.issue.useMutation({
    onSuccess: () => {
      void utils.adminGiftCards.list.invalidate();
      setShowForm(false);
      setAmount("50");
      setEmail("");
    },
  });
  const setActive = trpc.adminGiftCards.setActive.useMutation({
    onSuccess: () => {
      void utils.adminGiftCards.list.invalidate();
    },
  });

  const rows: GiftCardRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  function handleIssue() {
    issue.mutate({
      initialBalance: Math.round(Number(amount) * 100),
      ...(email.trim() ? { issuedToEmail: email.trim() } : {}),
    });
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Gift cards</h1>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancel" : "Issue gift card"}
          </Button>
        </div>

        {showForm ? (
          <div className="border-mist mb-8 flex max-w-md flex-col gap-3 border p-4">
            <Label htmlFor="amount">Amount (dollars)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
            <Label htmlFor="email">Recipient email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
            <Button disabled={issue.isPending} onClick={handleIssue} className="w-fit">
              {issue.isPending ? "Issuing…" : "Issue gift card"}
            </Button>
          </div>
        ) : null}

        {query.isError ? (
          <ErrorState title="Couldn't load gift cards" description={query.error.message} />
        ) : (
          <DataTable<GiftCardRow>
            columns={[
              { key: "code", header: "Code" },
              {
                key: "issuedToEmail",
                header: "Recipient",
                render: (row) => row.issuedToEmail ?? "—",
              },
              {
                key: "currentBalance",
                header: "Balance",
                render: (row) =>
                  `${formatPriceForDisplay(row.currentBalance, row.currency)} / ${formatPriceForDisplay(row.initialBalance, row.currency)}`,
              },
              {
                key: "isActive",
                header: "Status",
                render: (row) => (
                  <Badge variant={row.isActive ? "success" : "default"}>
                    {row.isActive ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
              {
                key: "id",
                header: "",
                render: (row) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActive.mutate({ id: row.id, isActive: !row.isActive });
                    }}
                  >
                    {row.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                ),
              },
            ]}
            rows={rows}
            keyExtractor={(row) => row.id}
            isLoading={query.isLoading}
            emptyState={
              <EmptyState
                icon={Gift}
                title="No gift cards"
                description="Issue your first gift card above."
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
