"use client";

import { Button, Input, Label, Section } from "@silonya/ui";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { trpcClient } from "@/lib/trpc-client";

export default function TrackOrderPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { token } = await trpcClient.checkout.lookupOrder.mutate({
        orderNumber: orderNumber.trim(),
        email: email.trim(),
      });
      router.push(`/order/confirmation?token=${token}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No order found matching that order number and email.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Section spacing="lg">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <h1 className="font-display text-ink text-3xl md:text-4xl">Track your order</h1>
          <p className="text-stone mt-2 font-sans text-sm">
            Enter your order number and the email you used at checkout.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-number">Order number</Label>
            <Input
              id="order-number"
              required
              value={orderNumber}
              onChange={(event) => {
                setOrderNumber(event.target.value);
              }}
              placeholder="SIL-483920"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-email">Email</Label>
            <Input
              id="order-email"
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              placeholder="you@example.com"
            />
          </div>
          {error ? <p className="text-error font-sans text-sm">{error}</p> : null}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Looking up your order…" : "Track order"}
          </Button>
        </form>
      </div>
    </Section>
  );
}
