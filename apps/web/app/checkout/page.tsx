"use client";

import {
  Button,
  Checkbox,
  EmptyState,
  Input,
  Label,
  PriceDisplay,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@silonya/ui";
import { calculateShipping, formatPriceForDisplay, type ShippingMethod } from "@silonya/utils";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { COUNTRIES, DEFAULT_COUNTRY_CODE, DIAL_CODES, PAKISTAN_PROVINCES } from "@/lib/countries";
import { useCartStore } from "@/lib/stores/cartStore";
import { trpcClient } from "@/lib/trpc-client";

interface AddressForm {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phoneDialCode: string;
  phoneNumber: string;
}

const defaultCountry = COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY_CODE) ?? COUNTRIES[0];

const emptyAddress: AddressForm = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: DEFAULT_COUNTRY_CODE,
  phoneDialCode: defaultCountry?.dialCode ?? "+92",
  phoneNumber: "",
};

function toAddressInput(form: AddressForm) {
  return {
    fullName: form.fullName.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || undefined,
    city: form.city.trim(),
    region: form.region.trim() || undefined,
    postalCode: form.postalCode.trim() || undefined,
    countryCode: form.countryCode.trim().toUpperCase(),
    phone: `${form.phoneDialCode} ${form.phoneNumber.trim()}`.trim(),
  };
}

const SHIPPING_OPTIONS: { value: ShippingMethod; label: string; eta: string }[] = [
  { value: "standard", label: "Standard Delivery", eta: "2–5 Business Days" },
  { value: "express", label: "Express Delivery", eta: "1–2 Business Days" },
];

export default function CheckoutPage() {
  const lines = useCartStore((state) => state.lines);
  const discountCode = useCartStore((state) => state.discountCode);

  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(emptyAddress);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);

  const currency = lines[0]?.currency ?? "PKR";
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const estimatedShipping = calculateShipping(subtotal, shippingMethod, false);
  const totalBeforeGiftCard = Math.max(0, subtotal + estimatedShipping - discountAmount);
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
    if (paymentMethod !== "cod") return;
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
        paymentMethod: "cod",
        shippingMethod,
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
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

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-ink text-xl">Delivery method</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              {SHIPPING_OPTIONS.map((option) => {
                const price = calculateShipping(subtotal, option.value, false);
                return (
                  <label
                    key={option.value}
                    aria-label={`${option.label}, ${option.eta}`}
                    className={`flex flex-1 cursor-pointer items-start gap-3 border p-4 transition-colors ${
                      shippingMethod === option.value
                        ? "border-ink"
                        : "border-mist hover:border-stone"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={option.value}
                      checked={shippingMethod === option.value}
                      onChange={() => {
                        setShippingMethod(option.value);
                      }}
                      className="mt-1"
                    />
                    <span className="flex flex-col">
                      <span className="text-ink font-sans text-sm font-medium">{option.label}</span>
                      <span className="text-stone font-sans text-xs">{option.eta}</span>
                      <span className="text-ink mt-1 font-sans text-sm">
                        {price === 0 ? "Free" : formatPriceForDisplay(price, currency)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-ink text-xl">Payment method</h2>
            <div className="flex flex-col gap-3">
              <label
                className={`flex cursor-pointer items-center gap-3 border p-4 transition-colors ${
                  paymentMethod === "cod" ? "border-ink" : "border-mist hover:border-stone"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => {
                    setPaymentMethod("cod");
                  }}
                />
                <span className="text-ink font-sans text-sm font-medium">Cash on Delivery</span>
              </label>
              <label
                aria-label="Online Payment"
                className={`flex cursor-pointer flex-col gap-1 border p-4 transition-colors ${
                  paymentMethod === "online" ? "border-ink" : "border-mist hover:border-stone"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    checked={paymentMethod === "online"}
                    onChange={() => {
                      setPaymentMethod("online");
                    }}
                  />
                  <span className="text-ink font-sans text-sm font-medium">Online Payment</span>
                </span>
                {paymentMethod === "online" ? (
                  <p className="text-stone ml-7 font-sans text-xs">
                    Online payment integration coming soon.
                  </p>
                ) : null}
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-note">Order notes (optional)</Label>
            <Textarea
              id="customer-note"
              value={customerNote}
              onChange={(event) => {
                setCustomerNote(event.target.value);
              }}
              rows={3}
              placeholder="Delivery instructions, landmark, preferred time…"
            />
          </div>

          {error ? <p className="text-error font-sans text-sm">{error}</p> : null}

          <Button
            type="submit"
            size="lg"
            disabled={submitting || paymentMethod !== "cod"}
            className="w-full lg:w-auto"
          >
            {paymentMethod !== "cod"
              ? "Online payment coming soon"
              : submitting
                ? "Placing order…"
                : "Place order"}
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
            <span>Shipping</span>
            {estimatedShipping === 0 ? (
              <span>Free</span>
            ) : (
              <PriceDisplay price={estimatedShipping} currency={currency} />
            )}
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
            <span>Total</span>
            <PriceDisplay price={estimatedTotal} currency={currency} />
          </div>

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

  const isPakistan = value.countryCode === "PK";

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-ink text-xl">{heading}</h2>

      <Label htmlFor={`${idPrefix}-fullName`}>Full name</Label>
      <Input {...field("fullName")} required placeholder="Full name" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_1fr]">
        <div>
          <Label htmlFor={`${idPrefix}-phoneDialCode`}>Code</Label>
          <Select
            value={value.phoneDialCode}
            onValueChange={(dialCode) => {
              onChange({ ...value, phoneDialCode: dialCode });
            }}
          >
            <SelectTrigger
              id={`${idPrefix}-phoneDialCode`}
              className="mt-1"
              aria-label="Country calling code"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIAL_CODES.map((option) => (
                <SelectItem key={option.dialCode} value={option.dialCode}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-phoneNumber`}>Mobile number</Label>
          <Input
            id={`${idPrefix}-phoneNumber`}
            type="tel"
            required
            value={value.phoneNumber}
            onChange={(event) => {
              onChange({ ...value, phoneNumber: event.target.value });
            }}
            placeholder={isPakistan ? "03XX XXXXXXX" : "Mobile number"}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-countryCode`}>Country</Label>
        <Select
          value={value.countryCode}
          onValueChange={(countryCode) => {
            const matchingDialCode = COUNTRIES.find((c) => c.code === countryCode)?.dialCode;
            onChange({
              ...value,
              countryCode,
              region: "",
              ...(matchingDialCode ? { phoneDialCode: matchingDialCode } : {}),
            });
          }}
        >
          <SelectTrigger id={`${idPrefix}-countryCode`} className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-region`}>Province</Label>
          {isPakistan ? (
            <Select
              value={value.region}
              onValueChange={(region) => {
                onChange({ ...value, region });
              }}
            >
              <SelectTrigger id={`${idPrefix}-region`} className="mt-1" aria-label="Province">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {PAKISTAN_PROVINCES.map((province) => (
                  <SelectItem key={province} value={province}>
                    {province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input {...field("region")} className="mt-1" />
          )}
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input {...field("city")} required className="mt-1" />
        </div>
      </div>

      <Label htmlFor={`${idPrefix}-line2`}>Area / Town</Label>
      <Input {...field("line2")} placeholder="Area or town" />

      <Label htmlFor={`${idPrefix}-line1`}>Complete address</Label>
      <Input {...field("line1")} required placeholder="House no., street, landmark" />

      <Label htmlFor={`${idPrefix}-postalCode`}>Postal code (optional)</Label>
      <Input {...field("postalCode")} />
    </div>
  );
}
