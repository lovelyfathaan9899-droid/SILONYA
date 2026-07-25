-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('order_confirmation', 'status_update', 'shipped', 'delivered', 'cancelled', 'help_response', 'generic');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "WhatsAppEventType" AS ENUM ('sent', 'delivered', 'read', 'failed', 'button_confirm', 'button_cancel', 'button_help', 'inbound_message');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('orders', 'customers', 'payments', 'inventory', 'reviews', 'system');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('dashboard', 'email', 'whatsapp', 'browser_push');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'pending_confirmation';
ALTER TYPE "OrderStatus" ADD VALUE 'confirmed';
ALTER TYPE "OrderStatus" ADD VALUE 'packed';
ALTER TYPE "OrderStatus" ADD VALUE 'out_for_delivery';

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "body_preview" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "to_phone" TEXT NOT NULL,
    "type" "WhatsAppMessageType" NOT NULL,
    "template_id" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'queued',
    "provider_message_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_events" (
    "id" TEXT NOT NULL,
    "message_id" TEXT,
    "order_id" TEXT,
    "type" "WhatsAppEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "wa_message_id" TEXT,
    "from_phone" TEXT,
    "customer_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "recipient" TEXT,
    "admin_user_id" TEXT,
    "metadata" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_name_key" ON "whatsapp_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_provider_message_id_key" ON "whatsapp_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_order_id_idx" ON "whatsapp_messages"("order_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_status_next_retry_at_idx" ON "whatsapp_messages"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "whatsapp_events_order_id_idx" ON "whatsapp_events"("order_id");

-- CreateIndex
CREATE INDEX "whatsapp_events_message_id_idx" ON "whatsapp_events"("message_id");

-- CreateIndex
CREATE INDEX "notification_logs_admin_user_id_read_at_created_at_idx" ON "notification_logs"("admin_user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_category_created_at_idx" ON "notification_logs"("category", "created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_events" ADD CONSTRAINT "whatsapp_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_events" ADD CONSTRAINT "whatsapp_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
