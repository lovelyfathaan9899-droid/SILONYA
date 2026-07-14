"use client";

import { Button, Input, toast } from "@silonya/ui";
import { X } from "lucide-react";
import { useState } from "react";
import { trpc, type ProductDetail } from "@/lib/trpc";

interface OptionDraft {
  name: string;
  values: string[];
}

function toDrafts(product: ProductDetail): OptionDraft[] {
  return product.options.map((option) => ({
    name: option.name,
    values: option.values.map((v) => v.value),
  }));
}

export function OptionsTab({ product }: { product: ProductDetail }) {
  const utils = trpc.useUtils();
  const [options, setOptions] = useState<OptionDraft[]>(() => toDrafts(product));

  const upsert = trpc.adminCatalog.options.upsert.useMutation({
    onSuccess: async () => {
      toast({ title: "Options saved", variant: "success" });
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
    },
    onError: (error) => {
      toast({ title: "Couldn't save options", description: error.message, variant: "error" });
    },
  });

  function updateOptionName(index: number, name: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, name } : o)));
  }

  function addValue(optionIndex: number) {
    setOptions((prev) =>
      prev.map((o, i) => (i === optionIndex ? { ...o, values: [...o.values, ""] } : o)),
    );
  }

  function updateValue(optionIndex: number, valueIndex: number, value: string) {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === optionIndex
          ? { ...o, values: o.values.map((v, j) => (j === valueIndex ? value : v)) }
          : o,
      ),
    );
  }

  function removeValue(optionIndex: number, valueIndex: number) {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === optionIndex ? { ...o, values: o.values.filter((_, j) => j !== valueIndex) } : o,
      ),
    );
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    const cleaned = options
      .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
      .filter((o) => o.name.length > 0 && o.values.length > 0);

    upsert.mutate({
      productId: product.id,
      options: cleaned.map((o) => ({ name: o.name, values: o.values.map((value) => ({ value })) })),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 py-6">
      {product.variants.length > 0 ? (
        <p className="border-mist text-stone border bg-white px-4 py-3 font-sans text-sm">
          This product already has variants. Saving changes here replaces the full option set —
          existing variants will need their option values reassigned on the Variants tab afterward.
        </p>
      ) : null}

      {options.map((option, optionIndex) => (
        <div key={optionIndex} className="border-mist flex flex-col gap-3 border p-4">
          <div className="flex items-center gap-2">
            <Input
              value={option.name}
              onChange={(e) => {
                updateOptionName(optionIndex, e.target.value);
              }}
              placeholder="Option name (e.g. Size)"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                removeOption(optionIndex);
              }}
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">Remove option</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {option.values.map((value, valueIndex) => (
              <div key={valueIndex} className="flex items-center gap-1">
                <Input
                  value={value}
                  onChange={(e) => {
                    updateValue(optionIndex, valueIndex, e.target.value);
                  }}
                  placeholder="Value"
                  className="w-28"
                />
                <button
                  type="button"
                  aria-label="Remove value"
                  onClick={() => {
                    removeValue(optionIndex, valueIndex);
                  }}
                  className="text-stone hover:text-ink"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                addValue(optionIndex);
              }}
            >
              Add value
            </Button>
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setOptions((prev) => [...prev, { name: "", values: [""] }]);
          }}
        >
          Add option
        </Button>
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save options"}
        </Button>
      </div>
    </div>
  );
}
