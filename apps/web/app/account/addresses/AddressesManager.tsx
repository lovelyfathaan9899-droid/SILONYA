"use client";

import type { AppRouter } from "@silonya/api";
import { Badge, Button, Input, Label, toast } from "@silonya/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { trpcClient } from "@/lib/trpc-client";

type Address = inferRouterOutputs<AppRouter>["account"]["addresses"]["list"][number];

interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

const emptyForm: AddressForm = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  phone: "",
};

function toFormInput(form: AddressForm) {
  return {
    line1: form.line1.trim(),
    line2: form.line2.trim() || undefined,
    city: form.city.trim(),
    region: form.region.trim() || undefined,
    postalCode: form.postalCode.trim(),
    countryCode: form.countryCode.trim().toUpperCase(),
    phone: form.phone.trim() || undefined,
  };
}

function toForm(address: Address): AddressForm {
  return {
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
    phone: address.phone ?? "",
  };
}

export function AddressesManager({
  initialAddresses,
  defaultShippingAddressId,
  defaultBillingAddressId,
}: {
  initialAddresses: Address[];
  defaultShippingAddressId: string | null;
  defaultBillingAddressId: string | null;
}) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [defaultShipping, setDefaultShipping] = useState(defaultShippingAddressId);
  const [defaultBilling, setDefaultBilling] = useState(defaultBillingAddressId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  function field(key: keyof AddressForm) {
    return {
      id: key,
      value: form[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [key]: event.target.value });
      },
    };
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(address: Address) {
    setEditingId(address.id);
    setForm(toForm(address));
    setShowForm(true);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await trpcClient.account.addresses.update.mutate({
          id: editingId,
          ...toFormInput(form),
        });
        setAddresses((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
      } else {
        const created = await trpcClient.account.addresses.create.mutate(toFormInput(form));
        setAddresses((prev) => [created, ...prev]);
      }
      setShowForm(false);
      toast({ title: "Address saved" });
    } catch {
      toast({ title: "Couldn't save address", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await trpcClient.account.addresses.delete.mutate({ id });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      if (defaultShipping === id) setDefaultShipping(null);
      if (defaultBilling === id) setDefaultBilling(null);
      toast({ title: "Address removed" });
    } catch {
      toast({ title: "Couldn't remove address", variant: "error" });
    }
  }

  async function handleSetDefault(id: string, type: "shipping" | "billing") {
    try {
      if (type === "shipping") {
        await trpcClient.account.addresses.setDefaultShipping.mutate({ id });
        setDefaultShipping(id);
      } else {
        await trpcClient.account.addresses.setDefaultBilling.mutate({ id });
        setDefaultBilling(id);
      }
      toast({ title: `Default ${type} address updated` });
    } catch {
      toast({ title: "Couldn't update default address", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {addresses.length === 0 ? (
        <p className="text-stone font-sans text-sm">You haven&apos;t saved any addresses yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="border-mist flex flex-col gap-2 border p-4">
              <p className="text-ink font-sans text-sm">{address.line1}</p>
              {address.line2 ? <p className="text-ink font-sans text-sm">{address.line2}</p> : null}
              <p className="text-ink font-sans text-sm">
                {address.city}
                {address.region ? `, ${address.region}` : ""} {address.postalCode}
              </p>
              <p className="text-ink font-sans text-sm">{address.countryCode}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {defaultShipping === address.id ? (
                  <Badge variant="accent">Default shipping</Badge>
                ) : null}
                {defaultBilling === address.id ? (
                  <Badge variant="accent">Default billing</Badge>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    startEdit(address);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(address.id)}>
                  Delete
                </Button>
                {defaultShipping !== address.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleSetDefault(address.id, "shipping")}
                  >
                    Set as default shipping
                  </Button>
                ) : null}
                {defaultBilling !== address.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleSetDefault(address.id, "billing")}
                  >
                    Set as default billing
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="border-mist flex max-w-md flex-col gap-3 border p-4"
        >
          <Label htmlFor="line1">Address</Label>
          <Input {...field("line1")} required placeholder="Street address" />
          <Input {...field("line2")} placeholder="Apartment, suite, etc. (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input {...field("city")} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="region">State / Region</Label>
              <Input {...field("region")} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="postalCode">Postal code</Label>
              <Input {...field("postalCode")} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="countryCode">Country (2-letter code)</Label>
              <Input {...field("countryCode")} required maxLength={2} className="mt-1 uppercase" />
            </div>
          </div>
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input {...field("phone")} type="tel" />
          <div className="mt-2 flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save address"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={startAdd} className="w-fit">
          Add address
        </Button>
      )}
    </div>
  );
}
