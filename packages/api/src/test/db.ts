import { prisma } from "@silonya/database";

/**
 * Wipes every table in the test database's `public` schema (except
 * Prisma's own migration-history table) between integration tests, so each
 * test starts from a known-empty state — real transactional isolation, not
 * a rollback-per-test, since the concurrency tests in this layer need
 * genuinely committed rows for separate connections to race against
 * (TESTING_STRATEGY.md §4). Table list is read from `pg_tables` rather than
 * hardcoded so it can't silently drift from the Prisma schema.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      )
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function createWarehouse(
  overrides: Partial<{ name: string; countryCode: string; isDefault: boolean }> = {},
) {
  return prisma.warehouse.create({
    data: {
      name: overrides.name ?? "Default Warehouse",
      countryCode: overrides.countryCode ?? "US",
      isDefault: overrides.isDefault ?? true,
    },
  });
}

/** A minimal but realistic Product + one ProductVariant + Inventory row — everything checkout.createIntent needs to reserve stock for a single line item. */
export async function createProductWithVariant(
  overrides: Partial<{
    slug: string;
    name: string;
    basePrice: number;
    sku: string;
    price: number | null;
    warehouseId: string;
    quantityOnHand: number;
    quantityReserved: number;
  }> = {},
) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const product = await prisma.product.create({
    data: {
      slug: overrides.slug ?? `test-product-${suffix}`,
      name: overrides.name ?? "Test Product",
      status: "active",
      basePrice: overrides.basePrice ?? 5000,
      currency: "USD",
      publishedAt: new Date(),
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: overrides.sku ?? `TEST-SKU-${suffix}`,
      price: overrides.price ?? null,
    },
  });

  const warehouseId = overrides.warehouseId ?? (await createWarehouse()).id;

  const inventory = await prisma.inventory.create({
    data: {
      variantId: variant.id,
      warehouseId,
      quantityOnHand: overrides.quantityOnHand ?? 10,
      quantityReserved: overrides.quantityReserved ?? 0,
    },
  });

  return { product, variant, warehouseId, inventory };
}
