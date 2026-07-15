import type { Prisma } from "@silonya/database";

type Tx = Prisma.TransactionClient;

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
