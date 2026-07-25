import { prisma, type NotificationCategory, type Prisma } from "@silonya/database";
import { sendAdminNotificationEmail, type AdminNotificationDetail } from "@silonya/emails";
import {
  sendWhatsAppMessage,
  toMetaPhoneFormat,
  type WhatsAppOutboundMessage,
} from "@silonya/whatsapp";

export interface DashboardNotificationInput {
  category: NotificationCategory;
  title: string;
  body: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fans a single event out into one NotificationLog row per active admin
 * (NOTIFICATION_ARCHITECTURE.md) — independent read/archive/dismiss state
 * per admin is the whole reason this is N rows and not one shared row.
 * Every admin currently gets every category; a per-admin category
 * subscription is a reasonable follow-up but isn't part of this system yet
 * (AdminUser has no preferences table to read from).
 */
export async function createDashboardNotification(
  input: DashboardNotificationInput,
): Promise<void> {
  const admins = await prisma.adminUser.findMany({
    where: { deactivatedAt: null },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.notificationLog.createMany({
    data: admins.map((admin) => ({
      category: input.category,
      channel: "dashboard" as const,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      adminUserId: admin.id,
      ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      status: "delivered" as const,
      sentAt: new Date(),
      deliveredAt: new Date(),
    })),
  });
}

/** Every admin with an email address gets one email; logged individually (channel="email") so delivery/failure is visible per-recipient in the notification history, not just fired-and-forgotten. */
export async function emailAllAdmins(input: {
  subject: string;
  title: string;
  details: AdminNotificationDetail[];
  category: NotificationCategory;
  linkUrl?: string;
}): Promise<void> {
  const admins = await prisma.adminUser.findMany({
    where: { deactivatedAt: null },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    const log = await prisma.notificationLog.create({
      data: {
        category: input.category,
        channel: "email",
        title: input.subject,
        body: input.title,
        linkUrl: input.linkUrl ?? null,
        recipient: admin.email,
        adminUserId: admin.id,
        status: "pending",
      },
    });
    try {
      await sendAdminNotificationEmail({
        to: admin.email,
        subject: input.subject,
        title: input.title,
        details: input.details,
        ...(input.linkUrl ? { linkUrl: input.linkUrl } : {}),
      });
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: "sent", sentAt: new Date() },
      });
    } catch (err) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown email error.",
        },
      });
    }
  }
}

/** Sends one WhatsApp message to the configured business number (WHATSAPP_BUSINESS_PHONE) — new-order alerts, not a customer-facing send, so it bypasses the order-scoped outbox/retry-queue and just logs to NotificationLog (channel="whatsapp"). */
export async function whatsAppBusinessAlert(input: {
  message: WhatsAppOutboundMessage;
  category: NotificationCategory;
  title: string;
  linkUrl?: string;
}): Promise<void> {
  const log = await prisma.notificationLog.create({
    data: {
      category: input.category,
      channel: "whatsapp",
      title: input.title,
      body: JSON.stringify(input.message),
      linkUrl: input.linkUrl ?? null,
      recipient: input.message.to,
      status: "pending",
    },
  });

  const result = await sendWhatsAppMessage(input.message);
  await prisma.notificationLog.update({
    where: { id: log.id },
    data: result.success
      ? { status: "sent", sentAt: new Date() }
      : { status: "failed", errorMessage: result.errorMessage ?? "Unknown WhatsApp error." },
  });
}

export function businessWhatsAppPhone(): string | null {
  const configured = process.env.WHATSAPP_BUSINESS_PHONE;
  return configured ? toMetaPhoneFormat(configured) : null;
}
