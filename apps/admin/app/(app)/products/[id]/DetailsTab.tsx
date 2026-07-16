"use client";

import { Button, Checkbox, Input, Label, Textarea, toast } from "@silonya/ui";
import { formatPriceForDisplay, parsePriceToMinorUnits } from "@silonya/utils";
import { useState } from "react";
import { trpc, type ProductDetail } from "@/lib/trpc";

/** Minimal create-on-the-fly affordance — there's no standalone Category/Collection admin screen yet (out of scope for this phase), and without this a product could never satisfy the "needs a category or collection" publish requirement. */
function QuickCreateTaxonomy({
  label,
  onCreate,
  isPending,
}: {
  label: string;
  onCreate: (name: string) => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        placeholder={`New ${label.toLowerCase()} name`}
        aria-label={`New ${label.toLowerCase()} name`}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={value.trim().length === 0 || isPending}
        onClick={() => {
          onCreate(value.trim());
          setValue("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

export function DetailsTab({ product }: { product: ProductDetail }) {
  const utils = trpc.useUtils();
  const categories = trpc.adminCatalog.taxonomy.listCategories.useQuery();
  const collections = trpc.adminCatalog.taxonomy.listCollections.useQuery();

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [priceInput, setPriceInput] = useState(
    formatPriceForDisplay(product.basePrice, product.currency).replace(/[^0-9.]/g, ""),
  );
  const [seoTitle, setSeoTitle] = useState(product.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(product.seoDescription ?? "");
  const [categoryIds, setCategoryIds] = useState(
    new Set(product.categories.map((c) => c.category.id)),
  );
  const [collectionIds, setCollectionIds] = useState(
    new Set(product.collections.map((c) => c.collection.id)),
  );

  const update = trpc.adminCatalog.products.update.useMutation({
    onSuccess: async () => {
      toast({ title: "Saved", variant: "success" });
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
      await utils.adminCatalog.products.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Couldn't save", description: error.message, variant: "error" });
    },
  });

  const createCategory = trpc.adminCatalog.taxonomy.createCategory.useMutation({
    onSuccess: async (category) => {
      await utils.adminCatalog.taxonomy.listCategories.invalidate();
      setCategoryIds((prev) => new Set(prev).add(category.id));
    },
    onError: (error) => {
      toast({ title: "Couldn't add category", description: error.message, variant: "error" });
    },
  });

  const createCollection = trpc.adminCatalog.taxonomy.createCollection.useMutation({
    onSuccess: async (collection) => {
      await utils.adminCatalog.taxonomy.listCollections.invalidate();
      setCollectionIds((prev) => new Set(prev).add(collection.id));
    },
    onError: (error) => {
      toast({ title: "Couldn't add collection", description: error.message, variant: "error" });
    },
  });

  function handleSave() {
    const basePrice = parsePriceToMinorUnits(priceInput);
    if (basePrice === null) {
      toast({ title: "Enter a valid price", variant: "error" });
      return;
    }

    update.mutate({
      id: product.id,
      name,
      description,
      basePrice,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
      categoryIds: [...categoryIds],
      collectionIds: [...collectionIds],
    });
  }

  function toggle(set: Set<string>, setter: (next: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  // Groups the flat category list into department headings with nested
  // subcategory checkboxes (PRODUCT_SYSTEM.md §5's hierarchical tree) —
  // `parentId` alone is enough, no extra query needed.
  const categoryList = categories.data ?? [];
  const topLevelCategories = categoryList.filter((c) => c.parentId === null);
  const subcategoriesByParent = new Map<string, typeof categoryList>();
  for (const category of categoryList) {
    if (category.parentId) {
      subcategoriesByParent.set(category.parentId, [
        ...(subcategoriesByParent.get(category.parentId) ?? []),
        category,
      ]);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 py-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-name">Name</Label>
        <Input
          id="detail-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-description">Description</Label>
        <Textarea
          id="detail-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          rows={5}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-price">Base price ({product.currency})</Label>
        <Input
          id="detail-price"
          value={priceInput}
          onChange={(e) => {
            setPriceInput(e.target.value);
          }}
          inputMode="decimal"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-seo-title">SEO title</Label>
        <Input
          id="detail-seo-title"
          value={seoTitle}
          onChange={(e) => {
            setSeoTitle(e.target.value);
          }}
          maxLength={70}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-seo-description">SEO description</Label>
        <Textarea
          id="detail-seo-description"
          value={seoDescription}
          onChange={(e) => {
            setSeoDescription(e.target.value);
          }}
          rows={2}
          maxLength={160}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Categories</Label>
        <div className="flex flex-col gap-4">
          {topLevelCategories.map((department) => (
            <div key={department.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`category-${department.id}`}
                  checked={categoryIds.has(department.id)}
                  onCheckedChange={() => {
                    toggle(categoryIds, setCategoryIds, department.id);
                  }}
                />
                <Label htmlFor={`category-${department.id}`} className="font-medium">
                  {department.name}
                </Label>
              </div>
              {(subcategoriesByParent.get(department.id) ?? []).length > 0 ? (
                <div className="ml-6 flex flex-col gap-2">
                  {(subcategoriesByParent.get(department.id) ?? []).map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`category-${sub.id}`}
                        checked={categoryIds.has(sub.id)}
                        onCheckedChange={() => {
                          toggle(categoryIds, setCategoryIds, sub.id);
                        }}
                      />
                      <Label htmlFor={`category-${sub.id}`}>{sub.name}</Label>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <QuickCreateTaxonomy
            label="Category"
            isPending={createCategory.isPending}
            onCreate={(value) => {
              createCategory.mutate({ name: value });
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Collections</Label>
        <div className="flex flex-col gap-2">
          {(collections.data ?? []).map((collection) => (
            <div key={collection.id} className="flex items-center gap-2">
              <Checkbox
                id={`collection-${collection.id}`}
                checked={collectionIds.has(collection.id)}
                onCheckedChange={() => {
                  toggle(collectionIds, setCollectionIds, collection.id);
                }}
              />
              <Label htmlFor={`collection-${collection.id}`}>{collection.name}</Label>
            </div>
          ))}
          <QuickCreateTaxonomy
            label="Collection"
            isPending={createCollection.isPending}
            onCreate={(value) => {
              createCollection.mutate({ name: value });
            }}
          />
        </div>
      </div>

      <div>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </div>
  );
}
