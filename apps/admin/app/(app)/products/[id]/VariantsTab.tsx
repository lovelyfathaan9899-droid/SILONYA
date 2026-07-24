"use client";

import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@silonya/ui";
import { parsePriceToMinorUnits } from "@silonya/utils";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { formatPKR } from "@/lib/currency";
import { trpc, type ProductDetail } from "@/lib/trpc";

type Variant = ProductDetail["variants"][number];

function variantLabel(variant: Variant): string {
  return variant.optionValues.map((ov) => ov.productOptionValue.value).join(" / ") || "—";
}

function AddVariantDialog({ product }: { product: ProductDetail }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");

  const upsert = trpc.adminCatalog.variants.upsert.useMutation({
    onSuccess: async () => {
      toast({ title: "Variant added", variant: "success" });
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
      setOpen(false);
      setSelectedValues({});
      setSku("");
      setPrice("");
    },
    onError: (error) => {
      toast({ title: "Couldn't add variant", description: error.message, variant: "error" });
    },
  });

  const allValuesSelected = product.options.every((option) => selectedValues[option.id]);

  function handleSubmit() {
    if (!allValuesSelected || sku.trim().length === 0) return;

    const parsedPrice = price.trim() ? parsePriceToMinorUnits(price) : null;

    upsert.mutate({
      productId: product.id,
      sku: sku.trim(),
      price: parsedPrice,
      optionValueIds: Object.values(selectedValues),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add variant</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add variant</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {product.options.map((option) => (
            <div key={option.id} className="flex flex-col gap-2">
              <Label htmlFor={`variant-option-${option.id}`}>{option.name}</Label>
              <Select
                value={selectedValues[option.id] ?? ""}
                onValueChange={(value) => {
                  setSelectedValues((prev) => ({ ...prev, [option.id]: value }));
                }}
              >
                <SelectTrigger id={`variant-option-${option.id}`}>
                  <SelectValue placeholder={`Select ${option.name.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {option.values.map((value) => (
                    <SelectItem key={value.id} value={value.id}>
                      {value.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Label htmlFor="variant-sku">SKU</Label>
            <Input
              id="variant-sku"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="variant-price">Price override (optional)</Label>
            <Input
              id="variant-price"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
              }}
              placeholder={formatPKR(product.basePrice)}
              inputMode="decimal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allValuesSelected || sku.trim().length === 0 || upsert.isPending}
          >
            {upsert.isPending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VariantsTab({ product }: { product: ProductDetail }) {
  const utils = trpc.useUtils();

  const deleteVariant = trpc.adminCatalog.variants.delete.useMutation({
    onSuccess: async () => {
      toast({ title: "Variant deleted" });
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
    },
    onError: (error) => {
      toast({ title: "Couldn't delete variant", description: error.message, variant: "error" });
    },
  });

  if (product.options.length === 0) {
    return (
      <p className="text-stone max-w-prose py-6 font-sans text-sm">
        Set up at least one option (e.g. Size or Color) on the Options tab before adding variants.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex justify-end">
        <AddVariantDialog product={product} />
      </div>

      <DataTable<Variant>
        columns={[
          { key: "sku", header: "SKU" },
          { key: "id", id: "options", header: "Options", render: variantLabel },
          {
            key: "price",
            header: "Price",
            render: (v) => formatPKR(v.price ?? product.basePrice),
          },
          {
            key: "inventory",
            header: "Stock",
            render: (v) => v.inventory.reduce((sum, inv) => sum + inv.quantityOnHand, 0),
          },
          {
            key: "id",
            id: "actions",
            header: "",
            render: (v) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  deleteVariant.mutate({ id: v.id });
                }}
                aria-label={`Delete variant ${v.sku}`}
              >
                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              </Button>
            ),
          },
        ]}
        rows={product.variants}
        keyExtractor={(v) => v.id}
        emptyState={<p className="text-stone font-sans text-sm">No variants yet.</p>}
      />
    </div>
  );
}
