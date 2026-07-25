import type { Order, OrderItem } from "@silonya/database";
import { formatPriceForDisplay } from "@silonya/utils";
import { buildAdminNewOrderAlertMessage } from "@silonya/whatsapp";
import {
  businessWhatsAppPhone,
  createDashboardNotification,
  emailAllAdmins,
  whatsAppBusinessAlert,
} from "./notification-service";

type OrderWithItems = Order & { items: OrderItem[]; customerName: string; customerPhone: string };

function adminOrderUrl(orderId: string): string {
  const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
  return `${adminBaseUrl}/orders/${orderId}`;
}

/**
 * REAL-TIME ADMIN NOTIFICATION SYSTEM spec — a new order fans out across
 * every channel in parallel: dashboard (bell icon, one row per admin),
 * email (one per admin), and WhatsApp (one message to the business number,
 * only if WHATSAPP_BUSINESS_PHONE is configured — silently skipped
 * otherwise, same "optional until configured" convention as every other
 * channel here). None of these await each other; a slow/failed channel
 * never blocks or breaks the others.
 */
export async function notifyNewOrder(order: OrderWithItems): Promise<void> {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const adminUrl = adminOrderUrl(order.id);

  const results = await Promise.allSettled([
    createDashboardNotification({
      category: "orders",
      title: "🔔 New Order Received",
      body: `${order.orderNumber} — ${order.customerName} — ${formatPriceForDisplay(order.grandTotal, order.currency)} (${String(itemCount)} item${itemCount === 1 ? "" : "s"})`,
      linkUrl: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        grandTotal: order.grandTotal,
        currency: order.currency,
        paymentMethod: order.paymentMethod,
      },
    }),
    emailAllAdmins({
      subject: "🛒 New Order - SILONYA",
      title: `New order ${order.orderNumber}`,
      details: [
        { label: "Order Number", value: order.orderNumber },
        { label: "Customer Name", value: order.customerName },
        { label: "Phone Number", value: order.customerPhone },
        { label: "Order Total", value: formatPriceForDisplay(order.grandTotal, order.currency) },
        {
          label: "Payment Method",
          value: order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
        },
        { label: "Time", value: order.createdAt.toISOString() },
      ],
      category: "orders",
      linkUrl: adminUrl,
    }),
    sendBusinessWhatsAppAlert(order, adminUrl),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[notifications] new-order fan-out channel failed:", result.reason);
    }
  }
}

async function sendBusinessWhatsAppAlert(
  order: OrderWithItems,
  orderAdminUrl: string,
): Promise<void> {
  const businessPhone = businessWhatsAppPhone();
  if (!businessPhone) return;

  const message = buildAdminNewOrderAlertMessage({
    businessPhone,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    grandTotal: order.grandTotal,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    orderAdminUrl,
  });

  await whatsAppBusinessAlert({
    message,
    category: "orders",
    title: `New order ${order.orderNumber}`,
    linkUrl: orderAdminUrl,
  });
}
