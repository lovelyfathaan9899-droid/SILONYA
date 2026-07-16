import { prisma } from "@silonya/database";

/**
 * Resolves a category slug to itself + all descendant category ids (BFS —
 * generic depth, not hardcoded to the current 2-level department/subcategory
 * tree). Lets a department page (e.g. `/categories/women`) match products
 * tagged to any of its leaf subcategories, since a product is only ever
 * assigned to a leaf category, never the bare department (PRODUCT_SYSTEM.md
 * §5). Returns `null` for an unknown slug so callers can fall back to `[]`
 * (matches nothing), the same behavior an exact-slug miss had before.
 */
export async function resolveCategoryIds(slug: string): Promise<string[] | null> {
  const root = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (!root) return null;

  const ids = [root.id];
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    if (children.length === 0) break;
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}
