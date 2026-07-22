"use client";

import { Button, Input, Label, toast } from "@silonya/ui";
import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { trpc, type ProductDetail } from "@/lib/trpc";

interface PendingUpload {
  url: string;
  altText: string;
}

/**
 * Signed direct-to-Cloudinary upload (ADMIN_PANEL.md §4.3): the file bytes
 * never pass through our server, only the Cloudinary response URL does.
 * Requires CLOUDINARY_* env vars to be set — getUploadSignature throws a
 * clear error otherwise (see packages/api/src/routers/admin-catalog/media.ts).
 */
async function uploadToCloudinary(
  file: File,
  signature: {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
    allowed_formats: string;
  },
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);
  // Must match the params the signature was computed over exactly
  // (packages/api/src/routers/admin-catalog/media.ts's getUploadSignature)
  // — Cloudinary rejects the upload if these params differ.
  formData.append("allowed_formats", signature.allowed_formats);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    throw new Error("Upload to Cloudinary failed.");
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("secure_url" in data) ||
    typeof data.secure_url !== "string"
  ) {
    throw new Error("Unexpected response from Cloudinary.");
  }

  return data.secure_url;
}

export function MediaTab({ product }: { product: ProductDetail }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const getSignature = trpc.adminCatalog.media.getUploadSignature.useMutation();
  const attachMedia = trpc.adminCatalog.media.attachMedia.useMutation({
    onSuccess: async () => {
      toast({ title: "Image added", variant: "success" });
      setPending(null);
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
    },
    onError: (error) => {
      toast({ title: "Couldn't save image", description: error.message, variant: "error" });
    },
  });
  const deleteMedia = trpc.adminCatalog.media.deleteMedia.useMutation({
    onSuccess: async () => {
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
    },
    onError: (error) => {
      toast({ title: "Couldn't delete image", description: error.message, variant: "error" });
    },
  });

  async function handleFileSelected(file: File) {
    setIsUploading(true);
    try {
      const signature = await getSignature.mutateAsync();
      const url = await uploadToCloudinary(file, signature);
      setPending({ url, altText: "" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 py-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {product.media.map((media) => (
          <div key={media.id} className="border-mist flex flex-col gap-2 border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local static asset */}
            <img
              src={media.url}
              alt={media.altText}
              className="aspect-square w-full object-cover"
            />
            <p className="text-stone truncate font-sans text-xs">{media.altText}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                deleteMedia.mutate({ id: media.id });
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1" />
              Remove
            </Button>
          </div>
        ))}
      </div>

      {pending ? (
        <div className="border-mist flex flex-col gap-3 border p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local static asset */}
          <img src={pending.url} alt="" className="h-32 w-32 object-cover" />
          <Label htmlFor="pending-alt-text">Alt text (required — DESIGN_SYSTEM.md §6)</Label>
          <Input
            id="pending-alt-text"
            value={pending.altText}
            onChange={(e) => {
              setPending({ ...pending, altText: e.target.value });
            }}
            placeholder="Describe the image for screen readers"
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setPending(null);
              }}
            >
              Discard
            </Button>
            <Button
              disabled={pending.altText.trim().length === 0 || attachMedia.isPending}
              onClick={() => {
                attachMedia.mutate({
                  productId: product.id,
                  url: pending.url,
                  altText: pending.altText.trim(),
                });
              }}
            >
              {attachMedia.isPending ? "Saving…" : "Save image"}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload size={16} strokeWidth={1.5} aria-hidden="true" className="mr-2" />
            {isUploading ? "Uploading…" : "Upload image"}
          </Button>
        </div>
      )}
    </div>
  );
}
