"use client";

import { Button, EmptyState, Icon, Input, PriceDisplay, Section, toast } from "@silonya/ui";
import { calculateShipping, formatPriceForDisplay } from "@silonya/utils";
import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCartStore } from "@/lib/stores/cartStore";
import { useIsLoggedIn } from "@/lib/customer-session-client";
import { trpcClient } from "@/lib/trpc-client";

export default function CartPage() {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const discountCode = useCartStore((state) => state.discountCode);
  const setDiscountCode = useCartStore((state) => state.setDiscountCode);
  const loggedIn = useIsLoggedIn();

  async function saveForLater(variantId: string) {
    try {
      await trpcClient.account.wishlist.add.mutate({ variantId, savedForLater: true });
      removeLine(variantId);
      toast({ title: "Saved for later" });
    } catch {
      toast({ title: "Couldn't save item", variant: "error" });
    }
  }

  const [codeInput, setCodeInput] = useState(discountCode ?? "");
  const [discountPreview, setDiscountPreview] = useState<{
    amount: number;
    freeShipping: boolean;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  const currency = lines[0]?.currency ?? "PKR";
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const estimatedShipping = calculateShipping(
    subtotal,
    "standard",
    discountPreview?.freeShipping ?? false,
  );
  const estimatedTotal = Math.max(0, subtotal + estimatedShipping - (discountPreview?.amount ?? 0));

  async function applyDiscount() {
    const code = codeInput.trim();
    if (!code) return;
    setCheckingDiscount(true);
    setDiscountError(null);
    try {
      const result = await trpcClient.checkout.previewDiscount.query({ code, subtotal });
      setDiscountPreview(result);
      setDiscountCode(code);
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "That discount code isn't valid.");
      setDiscountPreview(null);
      setDiscountCode(null);
    } finally {
      setCheckingDiscount(false);
    }
  }

  function removeDiscount() {
    setCodeInput("");
    setDiscountPreview(null);
    setDiscountError(null);
    setDiscountCode(null);
  }

  if (lines.length === 0) {
    return (
      <Section spacing="lg">
        <EmptyState
          title="Your bag is empty"
          description="Add something you'll love."
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
      <h1 className="font-display text-ink mb-8 text-3xl md:text-4xl">Bag</h1>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {lines.map((line) => (
            <div key={line.variantId} className="border-mist flex gap-4 border-b pb-6">
              <Link
                href={`/products/${line.productSlug}`}
                className="bg-mist relative h-32 w-24 shrink-0 overflow-hidden"
              >
                {line.imageUrl ? (
                  <Image src={line.imageUrl} alt="" fill sizes="6rem" className="object-cover" />
                ) : null}
              </Link>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="text-ink font-sans text-sm hover:underline"
                    >
                      {line.productName}
                    </Link>
                    <p className="text-stone font-sans text-xs">{line.variantLabel}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove from bag"
                    onClick={() => {
                      removeLine(line.variantId);
                    }}
                    className="text-stone hover:text-ink"
                  >
                    <Icon icon={X} size={16} />
                  </button>
                </div>
                <PriceDisplay price={line.unitPrice} currency={line.currency} className="text-sm" />
                <div className="border-mist flex w-fit items-center border">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => {
                      setQuantity(line.variantId, line.quantity - 1);
                    }}
                    className="text-ink hover:bg-mist flex h-9 w-9 items-center justify-center"
                  >
                    <Icon icon={Minus} size={14} />
                  </button>
                  <span className="w-9 text-center font-sans text-sm">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => {
                      setQuantity(line.variantId, line.quantity + 1);
                    }}
                    className="text-ink hover:bg-mist flex h-9 w-9 items-center justify-center"
                  >
                    <Icon icon={Plus} size={14} />
                  </button>
                </div>
                {loggedIn ? (
                  <button
                    type="button"
                    onClick={() => void saveForLater(line.variantId)}
                    className="text-stone hover:text-ink w-fit font-sans text-xs underline"
                  >
                    Save for later
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="border-mist flex flex-col gap-3 border p-6">
            <div className="text-ink flex items-center justify-between font-sans text-sm">
              <span>Subtotal</span>
              <PriceDisplay price={subtotal} currency={currency} />
            </div>
            <div className="text-ink flex items-center justify-between font-sans text-sm">
              <span>Estimated shipping</span>
              <span>
                {estimatedShipping === 0
                  ? "Free"
                  : formatPriceForDisplay(estimatedShipping, currency)}
              </span>
            </div>
            {discountPreview ? (
              <div className="text-ink flex items-center justify-between font-sans text-sm">
                <span>Discount ({discountCode})</span>
                <span>-{formatPriceForDisplay(discountPreview.amount, currency)}</span>
              </div>
            ) : null}
            <div className="border-mist text-ink flex items-center justify-between border-t pt-3 font-sans text-base font-medium">
              <span>Estimated total</span>
              <PriceDisplay price={estimatedTotal} currency={currency} />
            </div>
            <p className="text-stone font-sans text-xs">
              Final total, delivery method, and payment are confirmed at checkout.
            </p>
            <Button asChild size="lg" className="mt-2 w-full">
              <Link href="/checkout">Checkout</Link>
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="discount-code" className="text-ink font-sans text-sm">
              Discount code
            </label>
            <div className="flex gap-2">
              <Input
                id="discount-code"
                value={codeInput}
                onChange={(event) => {
                  setCodeInput(event.target.value);
                }}
                placeholder="Enter code"
              />
              {discountCode ? (
                <Button type="button" variant="secondary" onClick={removeDiscount}>
                  Remove
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void applyDiscount();
                  }}
                  disabled={checkingDiscount}
                >
                  Apply
                </Button>
              )}
            </div>
            {discountError ? <p className="text-error font-sans text-xs">{discountError}</p> : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
