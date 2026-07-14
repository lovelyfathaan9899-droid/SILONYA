import { prisma } from "@silonya/database";
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

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: UPLOAD_FOLDER },
      apiSecret,
    );

    return { timestamp, signature, apiKey, cloudName, folder: UPLOAD_FOLDER };
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
      await prisma.productMedia.delete({ where: { id: input.id } });
      return { success: true };
    }),
};
