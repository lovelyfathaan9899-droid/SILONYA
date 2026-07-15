"use client";

import { Button, Checkbox, EmptyState, Input, Label, PriceDisplay, Section } from "@silonya/ui";
import { calculateShipping, calculateTax, formatPriceForDisplay } from "@silonya/utils";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { useCartStore } from "@/lib/stores/cartStore";
import { trpcClient } from "@/lib/trpc-client";

interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

const emptyAddress: AddressForm = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  phone: "",
};

function toAddressInput(form: AddressForm) {
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

export default function CheckoutPage() {
  const lines = useCartStore((state) => state.lines);
  const discountCode = useCartStore((state) => state.discountCode);

  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(emptyAddress);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);

  const currency = lines[0]?.currency ?? "USD";
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const estimatedShipping = calculateShipping(subtotal, false);
  const estimatedTax = calculateTax(subtotal - discountAmount, shipping.countryCode || "US");
  const totalBeforeGiftCard = Math.max(
    0,
    subtotal + estimatedShipping + estimatedTax - discountAmount,
  );
  const giftCardApplied =
    giftCardBalance !== null ? Math.min(giftCardBalance, totalBeforeGiftCard) : 0;
  const estimatedTotal = totalBeforeGiftCard - giftCardApplied;

  useEffect(() => {
    if (!discountCode) {
      setDiscountAmount(0);
      return;
    }
    trpcClient.checkout.previewDiscount
      .query({ code: discountCode, subtotal })
      .then((result) => {
        setDiscountAmount(result.amount);
      })
      .catch(() => {
        setDiscountAmount(0);
      });
  }, [discountCode, subtotal]);

  async function checkGiftCard() {
    const code = giftCardCode.trim();
    if (!code) return;
    setCheckingGiftCard(true);
    setGiftCardError(null);
    try {
      const result = await trpcClient.giftCards.checkBalance.query({ code });
      setGiftCardBalance(result.currentBalance);
    } catch (err) {
      setGiftCardError(err instanceof Error ? err.message : "That gift card code isn't valid.");
      setGiftCardBalance(null);
    } finally {
      setCheckingGiftCard(false);
    }
  }

  function removeGiftCard() {
    setGiftCardCode("");
    setGiftCardBalance(null);
    setGiftCardError(null);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await trpcClient.checkout.createIntent.mutate({
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        guestEmail: email.trim(),
        shippingAddress: toAddressInput(shipping),
        ...(billingSameAsShipping ? {} : { billingAddress: toAddressInput(billing) }),
        ...(discountCode ? { discountCode } : {}),
        ...(giftCardBalance !== null ? { giftCardCode: giftCardCode.trim() } : {}),
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <Section spacing="lg">
        <EmptyState
          title="Your bag is empty"
          description="Add something you'll love before checking out."
          action={
            <Button asChild>
              <Link href="/">Continue shopping</Link>
            </Button>
          }
        />
      </Section>
    );
  }

  return (
    <Section spacing="lg">
      <h1 className="font-display text-ink mb-8 text-3xl md:text-4xl">Checkout</h1>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="grid grid-cols-1 gap-12 lg:grid-cols-3"
      >
        <div className="flex flex-col gap-10 lg:col-span-2">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-ink text-xl">Contact</h2>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              placeholder="you@example.com"
            />
          </div>

          <AddressFields
            heading="Shipping address"
            idPrefix="shipping"
            value={shipping}
            onChange={setShipping}
          />

          <div className="flex items-center gap-3">
            <Checkbox
              id="billing-same"
              checked={billingSameAsShipping}
              onCheckedChange={(checked) => {
                setBillingSameAsShipping(checked === true);
              }}
            />
            <Label htmlFor="billing-same">Billing address same as shipping</Label>
          </div>

          {billingSameAsShipping ? null : (
            <AddressFields
              heading="Billing address"
              idPrefix="billing"
              value={billing}
              onChange={setBilling}
            />
          )}

          {error ? <p className="text-error font-sans text-sm">{error}</p> : null}

          <Button type="submit" size="lg" disabled={submitting} className="w-full lg:w-auto">
            {submitting ? "Redirecting to payment…" : "Continue to payment"}
          </Button>
        </div>

        <div className="border-mist flex flex-col gap-4 border p-6">
          <h2 className="font-display text-ink text-lg">Order summary</h2>
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li key={line.variantId} className="text-ink flex justify-between font-sans text-sm">
                <span>
                  {line.productName} × {line.quantity}
                </span>
                <span>{formatPriceForDisplay(line.unitPrice * line.quantity, line.currency)}</span>
              </li>
            ))}
          </ul>
          <hr className="border-mist" />
          <div className="text-ink flex justify-between font-sans text-sm">
            <span>Subtotal</span>
            <PriceDisplay price={subtotal} currency={currency} />
          </div>
          <div className="text-ink flex justify-between font-sans text-sm">
            <span>Shipping (est.)</span>
            <PriceDisplay price={estimatedShipping} currency={currency} />
          </div>
          <div className="text-ink flex justify-between font-sans text-sm">
            <span>Tax (est.)</span>
            <PriceDisplay price={estimatedTax} currency={currency} />
          </div>
          {discountAmount > 0 ? (
            <div className="text-ink flex justify-between font-sans text-sm">
              <span>Discount</span>
              <span>-{formatPriceForDisplay(discountAmount, currency)}</span>
            </div>
          ) : null}
          {giftCardApplied > 0 ? (
            <div className="text-ink flex justify-between font-sans text-sm">
              <span>Gift card</span>
              <span>-{formatPriceForDisplay(giftCardApplied, currency)}</span>
            </div>
          ) : null}
          <hr className="border-mist" />
          <div className="text-ink flex justify-between font-sans text-base font-medium">
            <span>Estimated total</span>
            <PriceDisplay price={estimatedTotal} currency={currency} />
          </div>
          <p className="text-stone font-sans text-xs">
            Final totals are confirmed on the payment page.
          </p>

          <hr className="border-mist" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="gift-card-code">Gift card</Label>
            <div className="flex gap-2">
              <Input
                id="gift-card-code"
                value={giftCardCode}
                onChange={(event) => {
                  setGiftCardCode(event.target.value);
                }}
                placeholder="Enter code"
                disabled={giftCardBalance !== null}
              />
              {giftCardBalance !== null ? (
                <Button type="button" variant="secondary" onClick={removeGiftCard}>
                  Remove
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void checkGiftCard();
                  }}
                  disabled={checkingGiftCard}
                >
                  Apply
                </Button>
              )}
            </div>
            {giftCardError ? <p className="text-error font-sans text-xs">{giftCardError}</p> : null}
            {giftCardBalance !== null ? (
              <p className="text-stone font-sans text-xs">
                Balance: {formatPriceForDisplay(giftCardBalance, currency)}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </Section>
  );
}

function AddressFields({
  heading,
  idPrefix,
  value,
  onChange,
}: {
  heading: string;
  idPrefix: string;
  value: AddressForm;
  onChange: (value: AddressForm) => void;
}) {
  function field(key: keyof AddressForm) {
    return {
      id: `${idPrefix}-${key}`,
      value: value[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        onChange({ ...value, [key]: event.target.value });
      },
    };
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-ink text-xl">{heading}</h2>
      <Label htmlFor={`${idPrefix}-line1`}>Address</Label>
      <Input {...field("line1")} required placeholder="Street address" />
      <Input {...field("line2")} placeholder="Apartment, suite, etc. (optional)" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input {...field("city")} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-region`}>State / Region</Label>
          <Input {...field("region")} className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-postalCode`}>Postal code</Label>
          <Input {...field("postalCode")} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-countryCode`}>Country (2-letter code)</Label>
          <Input {...field("countryCode")} required maxLength={2} className="mt-1 uppercase" />
        </div>
      </div>
      <Label htmlFor={`${idPrefix}-phone`}>Phone (optional)</Label>
      <Input {...field("phone")} type="tel" />
    </div>
  );
}
