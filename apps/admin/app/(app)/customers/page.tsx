"use client";

import { Button, Container, DataTable, EmptyState, ErrorState, Input, Section } from "@silonya/ui";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface CustomerRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerifiedAt: Date | null;
  orderCount: number;
  createdAt: Date;
}

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  const query = trpc.adminCustomers.list.useInfiniteQuery(
    { limit: 20, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const rows: CustomerRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl">Customers</h1>
        </div>

        <div className="mb-4">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search name or email…"
            className="max-w-xs"
            aria-label="Search customers"
          />
        </div>

        {query.isError ? (
          <ErrorState
            title="Couldn't load customers"
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
          <DataTable<CustomerRow>
            columns={[
              {
                key: "email",
                header: "Customer",
                render: (row) => (
                  <div>
                    <p className="text-ink font-medium">{row.email}</p>
                    {row.firstName || row.lastName ? (
                      <p className="text-stone text-xs">
                        {row.firstName} {row.lastName}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "emailVerifiedAt",
                header: "Verified",
                render: (row) => (row.emailVerifiedAt ? "Yes" : "No"),
              },
              { key: "orderCount", header: "Orders" },
              {
                key: "createdAt",
                header: "Joined",
                render: (row) => new Date(row.createdAt).toLocaleDateString(),
              },
            ]}
            rows={rows}
            keyExtractor={(row) => row.id}
            isLoading={query.isLoading}
            onRowClick={(row) => {
              router.push(`/customers/${row.id}`);
            }}
            emptyState={
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Registered customers will appear here."
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
