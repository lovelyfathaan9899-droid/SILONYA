"use client";

import {
  Button,
  Container,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Section,
  toast,
} from "@silonya/ui";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

/** Converts a whole-rupee input string to integer minor units (paisa) — same rounding convention as packages/utils's parsePriceToMinorUnits, kept local since this form only ever deals with whole-rupee shipping fees, never fractional. */
function toMinorUnits(rupees: string): number {
  const parsed = Number.parseFloat(rupees);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function toRupeeString(minorUnits: number): string {
  return String(Math.round(minorUnits / 100));
}

/** ADMIN_PANEL.md — "shipping configurable from admin." Every value here is stored in minor units (paisa) but edited in whole rupees, matching how the rest of the admin panel presents PKR. */
export default function ShippingSettingsPage() {
  const utils = trpc.useUtils();
  const query = trpc.adminSettings.getShipping.useQuery();

  const [standard, setStandard] = useState("");
  const [express, setExpress] = useState("");
  const [freeThreshold, setFreeThreshold] = useState("");

  useEffect(() => {
    if (!query.data) return;
    setStandard(toRupeeString(query.data.standard));
    setExpress(toRupeeString(query.data.express));
    setFreeThreshold(toRupeeString(query.data.freeStandardThreshold));
  }, [query.data]);

  const update = trpc.adminSettings.updateShipping.useMutation({
    onSuccess: async () => {
      toast({ title: "Shipping settings saved" });
      await utils.adminSettings.getShipping.invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't save", description: error.message, variant: "error" });
    },
  });

  if (query.isLoading) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <LoadingState label="Loading shipping settings" />
        </Container>
      </Section>
    );
  }

  if (query.isError) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <ErrorState title="Couldn't load shipping settings" description={query.error.message} />
        </Container>
      </Section>
    );
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <h1 className="font-display text-ink mb-2 text-2xl">Shipping</h1>
        <p className="text-stone mb-6 font-sans text-sm">
          Rates charged at checkout — Standard Delivery becomes free once the order subtotal clears
          the free-delivery threshold below. Express is never free, regardless of order size.
        </p>

        <div className="border-mist flex max-w-md flex-col gap-4 border p-6">
          <div>
            <Label htmlFor="standard-rate">Standard Delivery rate (PKR)</Label>
            <Input
              id="standard-rate"
              type="number"
              min="0"
              step="1"
              value={standard}
              onChange={(event) => {
                setStandard(event.target.value);
              }}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="express-rate">Express Delivery rate (PKR)</Label>
            <Input
              id="express-rate"
              type="number"
              min="0"
              step="1"
              value={express}
              onChange={(event) => {
                setExpress(event.target.value);
              }}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="free-threshold">Free Standard Delivery above (PKR)</Label>
            <Input
              id="free-threshold"
              type="number"
              min="0"
              step="1"
              value={freeThreshold}
              onChange={(event) => {
                setFreeThreshold(event.target.value);
              }}
              className="mt-1"
            />
          </div>

          <Button
            disabled={update.isPending}
            onClick={() => {
              update.mutate({
                standardShippingRate: toMinorUnits(standard),
                expressShippingRate: toMinorUnits(express),
                freeShippingThreshold: toMinorUnits(freeThreshold),
              });
            }}
            className="w-fit"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Container>
    </Section>
  );
}
