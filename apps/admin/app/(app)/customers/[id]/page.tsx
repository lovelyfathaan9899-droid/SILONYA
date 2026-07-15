"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  ErrorState,
  Input,
  Label,
  Section,
  Spinner,
} from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const query = trpc.adminCustomers.detail.useQuery({ id: params.id });
  const utils = trpc.useUtils();
  const updateContact = trpc.adminCustomers.updateContactInfo.useMutation({
    onSuccess: () => {
      void utils.adminCustomers.detail.invalidate({ id: params.id });
    },
  });

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  if (query.isError) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <ErrorState title="Couldn't load customer" description={query.error.message} />
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

  const customer = query.data;

  function startEdit() {
    setFirstName(customer.firstName ?? "");
    setLastName(customer.lastName ?? "");
    setPhone(customer.phone ?? "");
    setEditing(true);
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-ink text-2xl">{customer.email}</h1>
            <p className="text-stone font-sans text-sm">
              {customer._count.orders} order{customer._count.orders === 1 ? "" : "s"} ·{" "}
              {customer._count.reviews} review{customer._count.reviews === 1 ? "" : "s"}
            </p>
          </div>
          {!editing ? (
            <Button variant="secondary" onClick={startEdit}>
              Edit contact info
            </Button>
          ) : null}
        </div>

        {editing ? (
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={updateContact.isPending}
                  onClick={() => {
                    updateContact.mutate(
                      { id: customer.id, firstName, lastName, phone },
                      {
                        onSuccess: () => {
                          setEditing(false);
                        },
                      },
                    );
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.addresses.length === 0 ? (
                <p className="text-stone font-sans text-sm">No saved addresses.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {customer.addresses.map((address) => (
                    <li key={address.id} className="text-ink font-sans text-sm">
                      {address.line1}, {address.city} {address.postalCode}, {address.countryCode}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.orders.length === 0 ? (
                <p className="text-stone font-sans text-sm">No orders yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {customer.orders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between">
                      <span className="text-ink font-sans text-sm">{order.orderNumber}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{order.status.replace(/_/g, " ")}</Badge>
                        <span className="text-ink font-sans text-sm">
                          {formatPriceForDisplay(order.grandTotal, order.currency)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
