import { prisma, Prisma } from "@silonya/database";
import { TRPCError } from "@trpc/server";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { requirePermission } from "../../trpc";

const catalogWrite = requirePermission("catalog:write");

const UPLOAD_FOLDER = "silonya/products";

function requireCloudinaryEnv(): { cloudName: string; apiKey: string; apiSecret: string } {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Media upload isn't configured yet (missing Cloudinary credentials).",
    });
  }

  return { cloudName, apiKey, apiSecret };
}

export const mediaRouter = {
  /**
   * Signed direct-upload flow (ADMIN_PANEL.md §4.3 — "direct-to-Cloudinary
   * upload widget"): the browser uploads the file bytes straight to
   * Cloudinary using these signed params, never through our server. This
   * procedure only needs the API secret to compute a signature — it works
   * (and typechecks/builds) even before real Cloudinary credentials exist;
   * the *upload itself* needs them at runtime.
   */
  getUploadSignature: catalogWrite.mutation(() => {
    const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
    const timestamp = Math.round(Date.now() / 1000);

    // `allowed_formats` is part of the signed payload — the upload request
    // must supply the exact same params to match this signature, and
    // Cloudinary rejects any other format server-side. Without this, any
    // catalog:write admin could sign an upload of any file type/size.
    const params = {
      timestamp,
      folder: UPLOAD_FOLDER,
      allowed_formats: "jpg,jpeg,png,webp,avif",
    };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    return { ...params, signature, apiKey, cloudName };
  }),

  attachMedia: catalogWrite
    .input(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable().optional(),
        url: z.string().url(),
        altText: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const last = await prisma.productMedia.findFirst({
        where: { productId: input.productId },
        orderBy: { position: "desc" },
      });

      return prisma.productMedia.create({
        data: {
          productId: input.productId,
          variantId: input.variantId ?? null,
          url: input.url,
          altText: input.altText,
          position: (last?.position ?? -1) + 1,
        },
      });
    }),

  deleteMedia: catalogWrite
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        await prisma.productMedia.delete({ where: { id: input.id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Image not found." });
        }
        throw error;
      }
      return { success: true };
    }),
};
