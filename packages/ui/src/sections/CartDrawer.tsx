"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";
import { Button } from "../primitives/Button";
import { EmptyState } from "../patterns/EmptyState";
import { PriceDisplay } from "../patterns/PriceDisplay";

export interface CartDrawerLine {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  currency: string;
  imageUrl: string | null;
  quantity: number;
}

export interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: CartDrawerLine[];
  onQuantityChange: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
}

/**
 * Bag contents only — no checkout button wired to anything yet
 * (checkout/payments are explicitly out of scope for this phase). Fully
 * controlled (no store import), per PROJECT_RULES.md §1 — apps/web wires
 * this to its Zustand cart store.
 */
export function CartDrawer({
  open,
  onOpenChange,
  lines,
  onQuantityChange,
  onRemove,
}: CartDrawerProps) {
  const currency = lines[0]?.currency ?? "USD";
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/40 fixed inset-0 z-40" />
        <DialogPrimitive.Content
          className={cn(
            "bg-bone fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col shadow-lg",
            "focus-visible:outline-none",
          )}
        >
          <div className="border-mist flex h-16 items-center justify-between border-b px-4">
            <DialogPrimitive.Title className="font-display text-ink text-lg">
              Bag
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close bag"
              className="text-ink focus-visible:ring-ink flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Icon icon={X} size={20} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {lines.length === 0 ? (
              <EmptyState title="Your bag is empty" description="Add something you'll love." />
            ) : (
              <ul className="flex flex-col gap-6 py-6">
                {lines.map((line) => (
                  <li key={line.variantId} className="flex gap-4">
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="bg-mist relative h-24 w-20 shrink-0 overflow-hidden"
                    >
                      {line.imageUrl ? (
                        <Image
                          src={line.imageUrl}
                          alt=""
                          fill
                          sizes="5rem"
                          className="object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="flex flex-1 flex-col gap-1">
                      <Link
                        href={`/products/${line.productSlug}`}
                        className="text-ink font-sans text-sm hover:underline"
                      >
                        {line.productName}
                      </Link>
                      <p className="text-stone font-sans text-xs">{line.variantLabel}</p>
                      <PriceDisplay
                        price={line.unitPrice}
                        currency={line.currency}
                        className="text-sm"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        <div className="border-mist flex items-center border">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => {
                              onQuantityChange(line.variantId, line.quantity - 1);
                            }}
                            className="text-ink hover:bg-mist flex h-8 w-8 items-center justify-center"
                          >
                            <Icon icon={Minus} size={14} />
                          </button>
                          <span className="w-8 text-center font-sans text-sm">{line.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => {
                              onQuantityChange(line.variantId, line.quantity + 1);
                            }}
                            className="text-ink hover:bg-mist flex h-8 w-8 items-center justify-center"
                          >
                            <Icon icon={Plus} size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onRemove(line.variantId);
                          }}
                          className="text-stone hover:text-ink font-sans text-xs underline underline-offset-4"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lines.length > 0 ? (
            <div className="border-mist border-t px-4 py-6">
              <div className="text-ink mb-4 flex items-center justify-between font-sans text-sm">
                <span>Subtotal</span>
                <PriceDisplay price={subtotal} currency={currency} />
              </div>
              <p className="text-stone mb-4 font-sans text-xs">
                Shipping and taxes calculated at checkout.
              </p>
              <Button className="w-full" disabled>
                Checkout — coming soon
              </Button>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
