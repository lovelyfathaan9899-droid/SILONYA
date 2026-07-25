import { prisma } from "@silonya/database";
import { DEFAULT_SHIPPING_RATES, type ShippingRates } from "@silonya/utils";

/**
 * StoreSettings is a singleton — exactly one row is ever expected. Rather
 * than requiring a seed step, the first read creates it (with the same
 * defaults DEFAULT_SHIPPING_RATES documents) so a fresh environment never
 * has to special-case "no settings row yet" — every caller just gets a row
 * back.
 */
export async function getStoreSettings() {
  const existing = await prisma.storeSettings.findFirst();
  if (existing) return existing;

  return prisma.storeSettings.create({
    data: {
      standardShippingRate: DEFAULT_SHIPPING_RATES.standard,
      expressShippingRate: DEFAULT_SHIPPING_RATES.express,
      freeShippingThreshold: DEFAULT_SHIPPING_RATES.freeStandardThreshold,
    },
  });
}

export async function getShippingRates(): Promise<ShippingRates> {
  const settings = await getStoreSettings();
  return {
    standard: settings.standardShippingRate,
    express: settings.expressShippingRate,
    freeStandardThreshold: settings.freeShippingThreshold,
  };
}

export interface UpdateStoreSettingsInput {
  standardShippingRate: number;
  expressShippingRate: number;
  freeShippingThreshold: number;
}

export async function updateStoreSettings(input: UpdateStoreSettingsInput) {
  const existing = await getStoreSettings();
  return prisma.storeSettings.update({ where: { id: existing.id }, data: input });
}
