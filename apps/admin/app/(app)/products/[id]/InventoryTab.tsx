"use client";

import { Button, Input, toast } from "@silonya/ui";
import { useState } from "react";
import { trpc, type ProductDetail } from "@/lib/trpc";

type Variant = ProductDetail["variants"][number];

function VariantInventoryRow({ variant, productId }: { variant: Variant; productId: string }) {
  const utils = trpc.useUtils();
  const currentQuantity = variant.inventory.reduce((sum, inv) => sum + inv.quantityOnHand, 0);
  const [quantity, setQuantity] = useState(String(currentQuantity));
  const [reason, setReason] = useState("");

  const adjust = trpc.adminCatalog.inventory.adjust.useMutation({
    onSuccess: async () => {
      toast({ title: "Stock updated", variant: "success" });
      setReason("");
      await utils.adminCatalog.products.get.invalidate({ id: productId });
    },
    onError: (error) => {
      toast({ title: "Couldn't update stock", description: error.message, variant: "error" });
    },
  });

  const parsedQuantity = Number.parseInt(quantity, 10);
  const isValid = Number.isInteger(parsedQuantity) && parsedQuantity >= 0;
  const isUnchanged = isValid && parsedQuantity === currentQuantity;

  return (
    <tr className="border-mist text-ink border-b font-sans text-sm last:border-b-0">
      <td className="px-4 py-4">{variant.sku}</td>
      <td className="px-4 py-4">
        <Input
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
          }}
          inputMode="numeric"
          className="w-24"
          aria-label={`Quantity on hand for ${variant.sku}`}
        />
      </td>
      <td className="px-4 py-4">
        <Input
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          placeholder="Reason for adjustment"
          aria-label={`Reason for adjusting ${variant.sku}`}
        />
      </td>
      <td className="px-4 py-4">
        <Button
          size="sm"
          disabled={!isValid || isUnchanged || reason.trim().length < 3 || adjust.isPending}
          onClick={() => {
            adjust.mutate({
              variantId: variant.id,
              quantityOnHand: parsedQuantity,
              reason: reason.trim(),
            });
          }}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

export function InventoryTab({ product }: { product: ProductDetail }) {
  if (product.variants.length === 0) {
    return (
      <p className="text-stone max-w-prose py-6 font-sans text-sm">
        Add variants first — inventory is tracked per variant.
      </p>
    );
  }

  return (
    <div className="py-6">
      <div className="border-mist overflow-x-auto border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-mist border-b">
              <th
                scope="col"
                className="text-stone px-4 py-3 font-sans text-xs uppercase tracking-wide"
              >
                SKU
              </th>
              <th
                scope="col"
                className="text-stone px-4 py-3 font-sans text-xs uppercase tracking-wide"
              >
                Quantity on hand
              </th>
              <th
                scope="col"
                className="text-stone px-4 py-3 font-sans text-xs uppercase tracking-wide"
              >
                Reason
              </th>
              <th
                scope="col"
                className="text-stone px-4 py-3 font-sans text-xs uppercase tracking-wide"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <VariantInventoryRow key={variant.id} variant={variant} productId={product.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
