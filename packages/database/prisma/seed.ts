import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../generated/client/index.js";
import { seedAccounts } from "./seed-accounts";
import { seedCatalog } from "./seed-catalog";
import { seedCms } from "./seed-cms";
import { seedDiscounts } from "./seed-discounts";

// Seeds the RBAC baseline (roles + permissions, AUTHENTICATION.md §4) and
// one super_admin account for local development. Not run in production —
// production admin accounts are provisioned by an existing admin
// (AUTHENTICATION.md §3), never by this script.
const prisma = new PrismaClient();

const PERMISSIONS = [
  "catalog:read",
  "catalog:write",
  "inventory:read",
  "inventory:write",
  "orders:read",
  "orders:write",
  "refunds:write",
  "discounts:read",
  "discounts:write",
  "users:read",
  "users:write",
  "roles:write",
  "reviews:read",
  "reviews:write",
  "gift_cards:read",
  "gift_cards:write",
  "content:read",
  "content:write",
  "analytics:read",
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  super_admin: PERMISSIONS,
  catalog_manager: [
    "catalog:read",
    "catalog:write",
    "inventory:read",
    "inventory:write",
    "reviews:read",
    "reviews:write",
    "content:read",
    "content:write",
  ],
  order_manager: [
    "orders:read",
    "orders:write",
    "refunds:write",
    "gift_cards:read",
    "gift_cards:write",
    "analytics:read",
  ],
  support: ["orders:read", "users:read", "reviews:read", "gift_cards:read"],
  viewer: [
    "catalog:read",
    "orders:read",
    "users:read",
    "inventory:read",
    "discounts:read",
    "reviews:read",
    "gift_cards:read",
    "content:read",
    "analytics:read",
  ],
};

async function main() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const seedEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@silonya.com";
  const seedPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me-immediately";
  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "super_admin" },
  });

  const passwordHash = await hash(seedPassword, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.adminUser.upsert({
    where: { email: seedEmail },
    update: {},
    create: {
      email: seedEmail,
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      roleId: superAdminRole.id,
    },
  });

  console.warn(`Seeded super_admin: ${seedEmail}`);
  if (!process.env.ADMIN_SEED_PASSWORD) {
    console.warn(
      'ADMIN_SEED_PASSWORD not set — used default "change-me-immediately". Set it in .env and re-seed for a real local password.',
    );
  }

  // Single-warehouse assumption for now (DATABASE_ARCHITECTURE.md §7 —
  // multi-warehouse is a later-phase concern). Every Inventory row created
  // by the admin catalog attaches to this warehouse.
  const existingDefaultWarehouse = await prisma.warehouse.findFirst({
    where: { isDefault: true },
  });
  if (!existingDefaultWarehouse) {
    await prisma.warehouse.create({
      data: { name: "Default Warehouse", countryCode: "US", isDefault: true },
    });
    console.warn("Seeded default warehouse.");
  }

  await seedCatalog(prisma);
  await seedDiscounts(prisma);
  await seedAccounts(prisma);
  await seedCms(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
