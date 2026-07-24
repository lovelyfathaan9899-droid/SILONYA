"use client";

import { Button, Input, toast } from "@silonya/ui";
import { GripVertical, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { trpc, type ProductDetail } from "@/lib/trpc";

interface UploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowed_formats: string;
}

/**
 * Signed direct-to-Cloudinary upload (ADMIN_PANEL.md §4.3): the file bytes
 * never pass through our server, only the Cloudinary response URL does.
 * Requires CLOUDINARY_* env vars to be set — getUploadSignature throws a
 * clear error otherwise (see packages/api/src/routers/admin-catalog/media.ts).
 */
async function uploadToCloudinary(file: File, signature: UploadSignature): Promise<string> {
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
    throw new Error(`Upload to Cloudinary failed (${String(response.status)}).`);
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

interface UploadTask {
  file: File;
  status: "queued" | "uploading" | "saving" | "done" | "error";
  error?: string;
}

export function MediaTab({ product }: { product: ProductDetail }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const existingCountRef = useRef(product.media.length);

  const getSignature = trpc.adminCatalog.media.getUploadSignature.useMutation();
  const attachMedia = trpc.adminCatalog.media.attachMedia.useMutation();
  const updateAltText = trpc.adminCatalog.media.updateAltText.useMutation();
  const deleteMedia = trpc.adminCatalog.media.deleteMedia.useMutation({
    onSuccess: async () => {
      await utils.adminCatalog.products.get.invalidate({ id: product.id });
    },
    onError: (error) => {
      toast({ title: "Couldn't delete image", description: error.message, variant: "error" });
    },
  });
  const reorderMedia = trpc.adminCatalog.media.reorderMedia.useMutation({
    onError: (error) => {
      toast({ title: "Couldn't save new order", description: error.message, variant: "error" });
      void utils.adminCatalog.products.get.invalidate({ id: product.id });
    },
  });

  /** Uploads every queued file one at a time — sequential, not parallel, so
   * each image's `position` (assigned server-side from the current max) is
   * assigned correctly without a race, and one failure doesn't abort the
   * rest of the batch. */
  async function processQueue(files: File[]) {
    setIsProcessing(true);
    existingCountRef.current = product.media.length;

    for (const [index, file] of files.entries()) {
      setQueue((prev) =>
        prev.map((task) => (task.file === file ? { ...task, status: "uploading" } : task)),
      );
      try {
        const signature = await getSignature.mutateAsync();
        const url = await uploadToCloudinary(file, signature);
        setQueue((prev) =>
          prev.map((task) => (task.file === file ? { ...task, status: "saving" } : task)),
        );
        await attachMedia.mutateAsync({
          productId: product.id,
          url,
          altText: `${product.name} — image ${String(existingCountRef.current + index + 1)}`,
        });
        setQueue((prev) =>
          prev.map((task) => (task.file === file ? { ...task, status: "done" } : task)),
        );
      } catch (error) {
        setQueue((prev) =>
          prev.map((task) =>
            task.file === file
              ? {
                  ...task,
                  status: "error",
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : task,
          ),
        );
      }
    }

    await utils.adminCatalog.products.get.invalidate({ id: product.id });
    setIsProcessing(false);
    setTimeout(() => {
      setQueue((prev) => prev.filter((task) => task.status === "error"));
    }, 2000);
  }

  function enqueueFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    setQueue((prev) => [...prev, ...files.map((file) => ({ file, status: "queued" as const }))]);
    void processQueue(files);
  }

  function handleThumbnailDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const ids = product.media.map((m) => m.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }
    const reordered = [...ids];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, draggedId);
    setDraggedId(null);

    utils.adminCatalog.products.get.setData({ id: product.id }, (current) =>
      current
        ? {
            ...current,
            media: reordered
              .map((id, position) => {
                const media = current.media.find((m) => m.id === id);
                return media ? { ...media, position } : null;
              })
              .filter((m): m is NonNullable<typeof m> => m !== null),
          }
        : current,
    );
    reorderMedia.mutate({ productId: product.id, orderedIds: reordered });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6 py-6">
      {product.media.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {product.media.map((media, index) => (
            <div
              key={media.id}
              draggable
              onDragStart={() => {
                setDraggedId(media.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                handleThumbnailDrop(media.id);
              }}
              className="border-mist bg-bone flex flex-col gap-2 border p-2"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local static asset */}
                <img
                  src={media.url}
                  alt={media.altText}
                  className="aspect-square w-full cursor-grab object-cover active:cursor-grabbing"
                />
                <span className="bg-ink/70 absolute left-1 top-1 flex h-6 w-6 items-center justify-center text-white">
                  <GripVertical size={14} strokeWidth={1.5} aria-hidden="true" />
                </span>
                {index === 0 ? (
                  <span className="bg-ink absolute right-1 top-1 px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wide text-white">
                    Cover
                  </span>
                ) : null}
              </div>
              <Input
                defaultValue={media.altText}
                aria-label="Alt text"
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== media.altText) {
                    updateAltText.mutate({ id: media.id, altText: value });
                  }
                }}
                className="text-xs"
              />
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
      )}

      {queue.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {queue.map((task) => (
            <li key={`${task.file.name}-${String(task.file.size)}`} className="font-sans text-xs">
              <span className="text-ink">{task.file.name}</span>{" "}
              <span
                className={
                  task.status === "error"
                    ? "text-error"
                    : task.status === "done"
                      ? "text-success"
                      : "text-stone"
                }
              >
                {task.status === "uploading"
                  ? "uploading…"
                  : task.status === "saving"
                    ? "saving…"
                    : task.status === "done"
                      ? "done"
                      : task.status === "error"
                        ? (task.error ?? "failed")
                        : "queued"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => {
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (event.dataTransfer.files.length > 0) enqueueFiles(event.dataTransfer.files);
        }}
        className={`border border-dashed p-8 text-center transition-colors ${
          dragActive ? "border-ink bg-mist/40" : "border-mist"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              enqueueFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
        <Upload
          size={24}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-stone mx-auto mb-3"
        />
        <p className="text-stone mb-3 font-sans text-sm">
          Drag images here, or choose files to upload — as many as you like.
        </p>
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          {isProcessing ? "Uploading…" : "Choose images"}
        </Button>
      </div>
    </div>
  );
}
