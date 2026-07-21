import type { Prisma } from "@silonya/database";

type Tx = Prisma.TransactionClient;

/**
 * Checkout-time reservation (PRODUCT_SYSTEM.md §4.3 — oversell prevention).
 * A single conditional UPDATE, not a read-then-write, so concurrent
 * checkouts against the same limited stock can never together reserve more
 * than what's on hand: Postgres row-level locking serializes concurrent
 * UPDATEs to the same inventory row, and the `WHERE` clause re-checks
 * availability atomically with the increment. An affected-row count of 0
 * means "not enough stock left" — the caller decides how to surface that
 * (checkout.createIntent turns it into a user-facing CONFLICT).
 */
export async function reserveInventory(
  tx: Tx,
  variantId: string,
  warehouseId: string,
  quantity: number,
): Promise<boolean> {
  const affected = await tx.$executeRaw`
    UPDATE inventory
    SET quantity_reserved = quantity_reserved + ${quantity}
    WHERE variant_id = ${variantId}
      AND warehouse_id = ${warehouseId}
      AND quantity_on_hand - quantity_reserved >= ${quantity}
  `;
  return affected > 0;
}

/** PRODUCT_SYSTEM.md §4.2 — payment succeeded: decrement quantityOnHand and release the matching reservation. */
export async function finalizeReservation(
  tx: Tx,
  items: { variantId: string; quantity: number }[],
  warehouseId: string,
): Promise<void> {
  for (const item of items) {
    await tx.$executeRaw`
      UPDATE inventory
      SET quantity_on_hand = quantity_on_hand - ${item.quantity},
          quantity_reserved = GREATEST(0, quantity_reserved - ${item.quantity})
      WHERE variant_id = ${item.variantId} AND warehouse_id = ${warehouseId}
    `;
  }
}

/** PRODUCT_SYSTEM.md §4.2 — payment failed/abandoned: release the reservation, stock never left quantityOnHand. */
export async function releaseReservation(
  tx: Tx,
  items: { variantId: string; quantity: number }[],
  warehouseId: string,
): Promise<void> {
  for (const item of items) {
    await tx.$executeRaw`
      UPDATE inventory
      SET quantity_reserved = GREATEST(0, quantity_reserved - ${item.quantity})
      WHERE variant_id = ${item.variantId} AND warehouse_id = ${warehouseId}
    `;
  }
}

/** ORDER_MANAGEMENT.md §6/§7 — an admin cancelling a paid-but-unfulfilled order (or restocking a return) puts stock that already left quantityOnHand back; never automatic for returns (§7 — "damaged returns are not restocked"), so callers pass this explicitly, not implicitly. */
export async function restockInventory(
  tx: Tx,
  items: { variantId: string; quantity: number }[],
  warehouseId: string,
): Promise<void> {
  for (const item of items) {
    await tx.$executeRaw`
      UPDATE inventory
      SET quantity_on_hand = quantity_on_hand + ${item.quantity}
      WHERE variant_id = ${item.variantId} AND warehouse_id = ${warehouseId}
    `;
  }
}
