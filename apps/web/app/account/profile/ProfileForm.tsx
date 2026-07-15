"use client";

import type { AppRouter } from "@silonya/api";
import { Button, Checkbox, Input, Label, toast } from "@silonya/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { useState, type SyntheticEvent } from "react";
import { trpcClient } from "@/lib/trpc-client";

type Profile = inferRouterOutputs<AppRouter>["account"]["profile"]["get"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [marketingOptIn, setMarketingOptIn] = useState(profile.marketingOptIn);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await trpcClient.account.profile.update.mutate({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        marketingOptIn,
      });
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Couldn't update profile", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex max-w-md flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Email</Label>
        <p className="text-stone font-sans text-sm">{profile.email}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox
          id="marketingOptIn"
          checked={marketingOptIn}
          onCheckedChange={(checked) => {
            setMarketingOptIn(checked === true);
          }}
        />
        <Label htmlFor="marketingOptIn">Send me news and offers</Label>
      </div>
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
