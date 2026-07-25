import { prisma, type Prisma, type WhatsAppMessageType } from "@silonya/database";
import { sendWhatsAppMessage, type WhatsAppOutboundMessage } from "@silonya/whatsapp";

/** 1 / 5 / 15 / 60 minutes, indexed by (attempts - 1) at the moment an attempt fails — DELIVERABLE spec's retry schedule. Exhausting the array (5th attempt) settles the message into "failed". */
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60] as const;

export interface EnqueueWhatsAppMessageInput {
  orderId: string | null;
  type: WhatsAppMessageType;
  message: WhatsAppOutboundMessage;
}

/**
 * Writes the WhatsAppMessage row before attempting any network call — the
 * payload/order/type are durable (audit trail, "Store Message IDs" spec
 * requirement) even if the send itself throws — then makes the first send
 * attempt immediately, so the common case (Meta accepts it) never waits for
 * the retry queue's next sweep.
 */
export async function enqueueWhatsAppMessage(
  input: EnqueueWhatsAppMessageInput,
): Promise<{ id: string; sent: boolean }> {
  const row = await prisma.whatsAppMessage.create({
    data: {
      orderId: input.orderId,
      toPhone: input.message.to,
      type: input.type,
      payload: input.message as unknown as Prisma.InputJsonValue,
      status: "queued",
    },
  });

  const sent = await attemptSend(row.id, input.message);
  return { id: row.id, sent };
}

/**
 * One send attempt against a specific WhatsAppMessage row — shared by
 * enqueueWhatsAppMessage's first attempt and the retry queue's subsequent
 * ones, so accounting (attempts/backoff/terminal state) only lives in one
 * place. Never throws: every outcome (configured-and-accepted,
 * configured-and-rejected, not configured, network error) is a normal
 * success/failure branch, matching sendWhatsAppMessage's own contract.
 */
export async function attemptSend(
  messageId: string,
  message: WhatsAppOutboundMessage,
): Promise<boolean> {
  const result = await sendWhatsAppMessage(message);
  const before = await prisma.whatsAppMessage.findUniqueOrThrow({
    where: { id: messageId },
    select: { attempts: true },
  });
  const attempts = before.attempts + 1;

  if (result.success) {
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: "sent",
        providerMessageId: result.providerMessageId,
        attempts,
        sentAt: new Date(),
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
    return true;
  }

  const backoffMinutes = RETRY_BACKOFF_MINUTES[attempts - 1];
  const nextRetryAt = backoffMinutes ? new Date(Date.now() + backoffMinutes * 60 * 1000) : null;

  await prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: {
      status: nextRetryAt ? "queued" : "failed",
      attempts,
      nextRetryAt,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      failedAt: nextRetryAt ? null : new Date(),
    },
  });
  return false;
}
