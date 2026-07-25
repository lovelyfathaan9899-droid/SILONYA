import { prisma } from "@silonya/database";
import { z } from "zod";
import { requirePermission, router } from "../trpc";
import {
  getShippingRates,
  getStoreSettings,
  updateStoreSettings,
} from "../services/store-settings";

const settingsRead = requirePermission("settings:read");
const settingsWrite = requirePermission("settings:write");

/** ADMIN_PANEL.md — "shipping configurable from admin." Currently the only store-wide setting; more (e.g. tax rates once a real market needs them) can be added as columns on the same StoreSettings singleton without a new router. */
export const adminSettingsRouter = router({
  getShipping: settingsRead.query(async () => {
    return getShippingRates();
  }),

  updateShipping: settingsWrite
    .input(
      z.object({
        standardShippingRate: z.number().int().min(0),
        expressShippingRate: z.number().int().min(0),
        freeShippingThreshold: z.number().int().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await updateStoreSettings(input);
      await prisma.auditLogEntry.create({
        data: {
          adminUserId: ctx.adminSession.userId,
          action: "update_store_settings",
          targetType: "StoreSettings",
          targetId: updated.id,
          metadata: { ...input },
        },
      });
      return updated;
    }),
});

export { getStoreSettings };
