import { prisma } from "@silonya/database";
import { slugify } from "@silonya/utils";

/**
 * Appends -2, -3, ... until an unused slug is found. Fine for
 * admin-single-actor creation flows (PRODUCT_SYSTEM.md, SEO_ARCHITECTURE.md
 * §4 — slugs are immutable once published, so getting this right at
 * creation time matters more than raw throughput here).
 */
export async function uniqueSlug(
  name: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name) || "item";
  let candidate = base;
  let attempt = 1;

  while (await exists(candidate)) {
    attempt += 1;
    candidate = `${base}-${String(attempt)}`;
  }

  return candidate;
}

/**
 * Single-warehouse assumption for this phase (DATABASE_ARCHITECTURE.md §7 —
 * multi-warehouse is explicitly a later-phase concern). Throws clearly if
 * the seed script hasn't run rather than silently creating inventory rows
 * with no warehouse.
 */
export async function getDefaultWarehouseId(): Promise<string> {
  const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { isDefault: true } });
  return warehouse.id;
}

/**
 * Zod's `.optional()` types a field as `X | undefined`; Prisma's generated
 * input types (under this project's `exactOptionalPropertyTypes: true`)
 * require an optional key to either be entirely absent or hold a concrete
 * value — never the literal `undefined`. This drops keys whose value is
 * `undefined` (both at runtime and in the returned type), so a
 * `{ ...input }` spread built from Zod-parsed input can be passed straight
 * to a Prisma `create`/`update` call.
 */
export function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}
