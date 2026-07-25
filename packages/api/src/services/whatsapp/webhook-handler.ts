import { prisma } from "@silonya/database";
import { parseButtonPayload } from "@silonya/whatsapp";
import { cancelOrderViaWhatsApp, confirmOrderViaWhatsApp } from "./confirm-cancel";

interface MetaWebhookStatusError {
  code: number;
  title: string;
}

interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id?: string;
  errors?: MetaWebhookStatusError[];
}

interface MetaWebhookButton {
  text: string;
  payload: string;
}

interface MetaWebhookInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  button?: MetaWebhookButton;
}

interface MetaWebhookChangeValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string };
  messages?: MetaWebhookInboundMessage[];
  statuses?: MetaWebhookStatus[];
}

interface MetaWebhookEntry {
  id: string;
  changes: { value: MetaWebhookChangeValue; field: string }[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

function isMetaWebhookPayload(value: unknown): value is MetaWebhookPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "entry" in value &&
    Array.isArray((value as { entry?: unknown }).entry)
  );
}

/**
 * SECURITY spec — "Prevent duplicate confirmations. Prevent replay
 * attacks." One row per individual event (not per HTTP request): a single
 * webhook delivery can bundle several status/message events, and a
 * Meta-side redelivery can bundle a different subset of a previously seen
 * batch, so request-level idempotency alone isn't enough. Reuses
 * ProcessedWebhookEvent (provider: "whatsapp") — the same table/pattern the
 * Stripe webhook already relies on, not a parallel mechanism.
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({ data: { provider: "whatsapp", eventId } });
    return false;
  } catch {
    return true;
  }
}

/**
 * WebhookController's payload dispatch (WHATSAPP_ARCHITECTURE.md). Two
 * kinds of events arrive on the same endpoint: delivery/read/failed
 * receipts for messages *we* sent (`statuses[]`, synced onto the matching
 * WhatsAppMessage row by `providerMessageId`) and inbound events from the
 * customer (`messages[]`) — of which only `type: "button"` (a tap on one
 * of our Confirm/Cancel quick-reply buttons) drives a state change; every
 * other inbound message type is recorded for the audit trail and otherwise
 * ignored (there's no free-form customer-support inbox in this system).
 */
export async function processWhatsAppWebhookPayload(rawBody: unknown): Promise<void> {
  if (!isMetaWebhookPayload(rawBody)) return;

  for (const entry of rawBody.entry) {
    for (const change of entry.changes) {
      for (const status of change.value.statuses ?? []) {
        await handleStatusEvent(status);
      }
      for (const message of change.value.messages ?? []) {
        await handleInboundMessage(message);
      }
    }
  }
}

async function handleStatusEvent(status: MetaWebhookStatus): Promise<void> {
  if (await alreadyProcessed(`status_${status.id}_${status.status}`)) return;

  const message = await prisma.whatsAppMessage.findUnique({
    where: { providerMessageId: status.id },
  });
  if (!message) return;

  const timestamp = new Date(Number(status.timestamp) * 1000);

  if (status.status === "delivered") {
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "delivered", deliveredAt: timestamp },
    });
  } else if (status.status === "read") {
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "read", readAt: timestamp },
    });
  } else if (status.status === "failed") {
    const err = status.errors?.[0];
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "failed",
        failedAt: timestamp,
        errorCode: err ? String(err.code) : null,
        errorMessage: err?.title ?? null,
      },
    });
  }
  // "sent" receipts don't need to overwrite outbox.ts's own optimistic "sent" write.

  await prisma.whatsAppEvent.create({
    data: {
      orderId: message.orderId,
      messageId: message.id,
      type:
        status.status === "delivered"
          ? "delivered"
          : status.status === "read"
            ? "read"
            : status.status === "failed"
              ? "failed"
              : "sent",
      payload: status as unknown as never,
      waMessageId: status.id,
      fromPhone: status.recipient_id ?? null,
    },
  });
}

async function handleInboundMessage(message: MetaWebhookInboundMessage): Promise<void> {
  if (await alreadyProcessed(`message_${message.id}`)) return;

  if (message.type !== "button" || !message.button) {
    await prisma.whatsAppEvent.create({
      data: {
        type: "inbound_message",
        payload: message as unknown as never,
        waMessageId: message.id,
        fromPhone: message.from,
      },
    });
    return;
  }

  const parsed = parseButtonPayload(message.button.payload);
  if (!parsed) return;

  const meta = {
    waMessageId: message.id,
    fromPhone: message.from,
    timestamp: new Date(Number(message.timestamp) * 1000),
    customerIp: null,
  };

  if (parsed.action === "confirm") {
    await confirmOrderViaWhatsApp(parsed.orderId, meta, message);
  } else {
    await cancelOrderViaWhatsApp(parsed.orderId, meta, message);
  }
}
