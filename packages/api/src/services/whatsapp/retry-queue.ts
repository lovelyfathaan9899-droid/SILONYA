import { prisma } from "@silonya/database";
import type { WhatsAppOutboundMessage } from "@silonya/whatsapp";
import { attemptSend } from "./outbox";

const BATCH_SIZE = 50;

/**
 * DeliveryStatusSync's counterpart on the send side — the DB-backed retry
 * queue (WHATSAPP_ARCHITECTURE.md). Same "no Redis/BullMQ provisioned in
 * this environment" reasoning and cron-callable, schedule-agnostic design
 * as services/order-fulfillment.ts's releaseExpiredReservations: picks up
 * every WhatsAppMessage whose `nextRetryAt` has passed (rows with a null
 * `nextRetryAt` — sent, failed, or genuinely never-configured-for-retry —
 * never match, since SQL `<=` against NULL is never true) and re-attempts
 * each one via outbox.ts's attemptSend, which owns the backoff/terminal
 * accounting.
 */
export async function processWhatsAppRetryQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const due = await prisma.whatsAppMessage.findMany({
    where: { status: "queued", nextRetryAt: { lte: new Date() } },
    take: BATCH_SIZE,
    orderBy: { nextRetryAt: "asc" },
  });

  let sent = 0;
  for (const row of due) {
    const message = row.payload as unknown as WhatsAppOutboundMessage;
    const ok = await attemptSend(row.id, message);
    if (ok) sent++;
  }

  return { processed: due.length, sent, failed: due.length - sent };
}
