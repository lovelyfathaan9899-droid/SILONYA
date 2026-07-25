import { signOrderAccessToken, verifyOrderAccessToken } from "@silonya/auth";
import { prisma } from "@silonya/database";
import { sendOrderConfirmationEmail } from "@silonya/emails";
import { calculateShipping, calculateTax, generateOrderNumber } from "@silonya/utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDefaultWarehouseId } from "../admin-catalog/shared";
import { publicProcedure, router } from "../../trpc";
import { checkRateLimit } from "../../lib/rate-limit";
import { siteUrl } from "../../lib/site-url";
import { toOrderEmailData } from "../../lib/order-email-mapper";
import { finalizeReservation, reserveInventory } from "../../services/inventory";
import { notifyNewOrder } from "../../services/notifications/order-events";
import { getShippingRates } from "../../services/store-settings";
import { sendOrderConfirmationWhatsApp } from "../../services/whatsapp/order-notifications";
import { findRedeemableGiftCard } from "../gift-cards";
import {
  assertDiscountStillRedeemable,
  CURRENCY,
  findAutomaticDiscount,
  toAddressCreateInput,
  validateDiscountCode,
  variantLabel,
} from "./shared";

const addressInput = z.object({
  fullName: z.string().trim().min(1),
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  countryCode: z.string().trim().length(2),
  phone: z.string().trim().min(1),
  whatsappPhone: z.string().trim().min(1).optional(),
});

const MAX_RETRY_ON_ORDER_NUMBER_COLLISION = 3;

export const checkoutRouter = router({
  /**
   * ORDER_MANAGEMENT.md §3 — the entire checkout-to-confirmed-order flow in
   * one procedure: re-validate cart against live data, reserve inventory,
   * create the Order, finalize it immediately. Pakistan launch supports
   * Cash on Delivery only (PAYMENT_ARCHITECTURE.md) — "online" is rejected
   * up front, before any reservation/DB write, so a real payment-gateway
   * branch (Stripe Checkout Session creation, previously here) has nowhere
   * live to run; it's removed rather than left as dead code reachable by
   * nothing, and comes back the day `paymentMethod: "online"` is actually
   * allowed through (the Stripe client/webhook/refund infrastructure
   * elsewhere in the codebase is untouched).
   */
  createIntent: publicProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }),
          )
          .min(1),
        guestEmail: z.string().trim().email(),
        shippingAddress: addressInput,
        billingAddress: addressInput.optional(),
        discountCode: z.string().trim().min(1).optional(),
        giftCardCode: z.string().trim().min(1).optional(),
        paymentMethod: z.enum(["cod", "online"]),
        shippingMethod: z.enum(["standard", "express"]),
        customerNote: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.paymentMethod === "online") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Online payment isn't available yet — please select Cash on Delivery.",
        });
      }

      // SECURITY_ARCHITECTURE.md §3.5 — abuse protection on checkout
      // (card-testing/carding, per the threat model in that doc).
      const rateLimitResult = checkRateLimit(
        `checkout:${input.guestEmail.toLowerCase()}`,
        20,
        60 * 60 * 1000,
      );
      if (!rateLimitResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many checkout attempts. Please try again in a few minutes.",
        });
      }

      const userId = ctx.customerSession?.userId ?? null;
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: input.items.map((item) => item.variantId) } },
        include: {
          product: true,
          optionValues: { include: { productOptionValue: true } },
        },
      });
      const variantById = new Map(variants.map((v) => [v.id, v]));

      for (const item of input.items) {
        const variant = variantById.get(item.variantId);
        if (!variant) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more items in your bag are no longer available.",
          });
        }
        if (variant.product.status !== "active" || variant.product.deletedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more items in your bag are no longer available.",
          });
        }
      }

      const unitPriceByVariantId = new Map(
        input.items.map((item) => {
          const variant = variantById.get(item.variantId);
          if (!variant) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid item." });
          return [item.variantId, variant.price ?? variant.product.basePrice];
        }),
      );

      const subtotal = input.items.reduce(
        (sum, item) => sum + (unitPriceByVariantId.get(item.variantId) ?? 0) * item.quantity,
        0,
      );

      const discount = input.discountCode
        ? await validateDiscountCode(input.discountCode, subtotal, userId)
        : await findAutomaticDiscount(subtotal, userId);

      const shippingRates = await getShippingRates();
      const shippingTotal = calculateShipping(
        subtotal,
        input.shippingMethod,
        discount?.freeShipping ?? false,
        shippingRates,
      );
      const taxableAmount = subtotal - (discount?.amount ?? 0);
      const taxTotal = calculateTax(taxableAmount, input.shippingAddress.countryCode);
      const totalBeforeGiftCard = Math.max(
        0,
        subtotal + shippingTotal + taxTotal - (discount?.amount ?? 0),
      );

      const giftCard = input.giftCardCode ? await findRedeemableGiftCard(input.giftCardCode) : null;
      if (giftCard && giftCard.currency !== CURRENCY) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That gift card can't be used for this order.",
        });
      }
      const giftCardApplied = giftCard ? Math.min(giftCard.currentBalance, totalBeforeGiftCard) : 0;
      const grandTotal = totalBeforeGiftCard - giftCardApplied;

      const warehouseId = await getDefaultWarehouseId();

      let order: Awaited<ReturnType<typeof createOrder>> | null = null;
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_RETRY_ON_ORDER_NUMBER_COLLISION; attempt++) {
        try {
          order = await createOrder();
          break;
        } catch (err) {
          lastError = err;
          if (!isUniqueOrderNumberConflict(err)) throw err;
        }
      }
      if (!order) {
        throw lastError instanceof Error
          ? lastError
          : new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      async function createOrder() {
        // Default Prisma interactive-transaction timeout (5s) is too tight
        // for this transaction's query count (reserve inventory, create
        // addresses/cart/order/items, optional discount/gift-card ledger
        // writes, optional zero-dollar finalize) against real network
        // latency to the database — bumped to 15s so a briefly slow
        // connection doesn't fail an otherwise-valid checkout.
        return prisma.$transaction(
          async (tx) => {
            for (const item of input.items) {
              const reserved = await reserveInventory(
                tx,
                item.variantId,
                warehouseId,
                item.quantity,
              );
              if (!reserved) {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: "One or more items just sold out. Please review your bag.",
                });
              }
            }

            const shippingAddress = await tx.address.create({
              data: toAddressCreateInput(input.shippingAddress, userId),
            });
            const billingAddress = input.billingAddress
              ? await tx.address.create({
                  data: toAddressCreateInput(input.billingAddress, userId),
                })
              : shippingAddress;

            await tx.cart.create({
              data: {
                currency: CURRENCY,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                items: {
                  create: input.items.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPriceSnapshot: unitPriceByVariantId.get(item.variantId) ?? 0,
                  })),
                },
              },
            });

            // No async payment step to wait for (COD is the only reachable
            // method — see the top-of-procedure rejection of "online"), so
            // the order is created directly in its settled state rather
            // than passing through pending_payment at all. "paid" only when
            // discount/gift card cover the whole order (nothing left to
            // collect on delivery — there's no COD balance to confirm, so
            // the WhatsApp confirmation gate doesn't apply); otherwise
            // "pending_confirmation" — the WhatsApp order-confirmation
            // message (sent below, after the transaction commits) is what
            // moves it to "confirmed" once the customer taps Confirm
            // (WHATSAPP_ARCHITECTURE.md).
            const initialStatus = grandTotal === 0 ? "paid" : "pending_confirmation";

            const createdOrder = await tx.order.create({
              data: {
                orderNumber: generateOrderNumber(),
                userId,
                guestEmail: input.guestEmail,
                status: initialStatus,
                // Always set, regardless of status — the order is genuinely
                // placed now in both cases (paid outright, or processing
                // with cash due on delivery). admin-analytics.ts and
                // services/reports.ts filter on `placedAt >= X`; leaving
                // this null for "processing" would silently exclude every
                // COD order (now the only order type) from all reporting.
                placedAt: new Date(),
                subtotal,
                shippingTotal,
                taxTotal,
                discountTotal: discount?.amount ?? 0,
                giftCardTotal: giftCardApplied,
                grandTotal,
                currency: CURRENCY,
                paymentMethod: "cod",
                shippingMethod: input.shippingMethod,
                customerNote: input.customerNote ?? null,
                shippingAddressId: shippingAddress.id,
                billingAddressId: billingAddress.id,
                discountId: discount?.id ?? null,
                items: {
                  create: input.items.map((item) => {
                    const variant = variantById.get(item.variantId);
                    if (!variant) throw new TRPCError({ code: "BAD_REQUEST" });
                    const unitPrice = unitPriceByVariantId.get(item.variantId) ?? 0;
                    return {
                      variantId: item.variantId,
                      productNameSnapshot: variant.product.name,
                      variantLabelSnapshot: variantLabel(variant.optionValues),
                      skuSnapshot: variant.sku,
                      unitPrice,
                      quantity: item.quantity,
                      lineTotal: unitPrice * item.quantity,
                    };
                  }),
                },
              },
              include: { items: true },
            });

            if (discount) {
              await assertDiscountStillRedeemable(tx, discount.id, userId);
              await tx.discountRedemption.create({
                data: { discountId: discount.id, orderId: createdOrder.id, userId },
              });
            }

            if (giftCard && giftCardApplied > 0) {
              const updated = await tx.giftCard.updateMany({
                where: { id: giftCard.id, currentBalance: { gte: giftCardApplied } },
                data: { currentBalance: { decrement: giftCardApplied } },
              });
              if (updated.count === 0) {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: "That gift card's balance changed. Please try again.",
                });
              }
              await tx.giftCardTransaction.create({
                data: {
                  giftCardId: giftCard.id,
                  orderId: createdOrder.id,
                  type: "redeemed",
                  amount: giftCardApplied,
                },
              });
            }

            // No async payment step to wait for — the reservation converts
            // to a real, finalized deduction immediately (COD collects cash
            // on delivery, not here; the goods are still committed to this
            // order right now, same as a webhook-confirmed Stripe payment
            // would finalize them in services/order-fulfillment.ts).
            await finalizeReservation(tx, createdOrder.items, warehouseId);
            await tx.orderStatusEvent.create({
              data: {
                orderId: createdOrder.id,
                status: initialStatus,
                triggeredBy: "system",
                note:
                  initialStatus === "paid"
                    ? "Fully covered by discount/gift card — no payment required."
                    : "Order placed — awaiting confirmation via WhatsApp.",
              },
            });

            return createdOrder;
          },
          { timeout: 15000 },
        );
      }

      const accessToken = await signOrderAccessToken({
        orderId: order.id,
        email: input.guestEmail,
      });
      const confirmationUrl = `${siteUrl()}/order/confirmation?token=${accessToken}`;

      // Order is already fully settled (paid, or pending_confirmation with
      // cash due on delivery) from the transaction above — no payment
      // gateway round-trip to wait on, so the customer goes straight to the
      // confirmation page.
      const orderWithDetails = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, shippingAddress: true, billingAddress: true },
      });

      // WhatsApp is the primary confirmation channel (WHATSAPP_ARCHITECTURE.md
      // — its Confirm/Cancel buttons are what actually drive the order out
      // of pending_confirmation); email is sent alongside it as a
      // best-effort courtesy copy, same as before. Neither blocks the
      // response — a failed send here shouldn't fail an otherwise-successful
      // checkout.
      const emailData = toOrderEmailData(orderWithDetails, confirmationUrl);
      if (emailData) {
        await sendOrderConfirmationEmail(emailData).catch((err: unknown) => {
          console.error("[checkout] failed to send order confirmation email:", err);
        });
      }
      await sendOrderConfirmationWhatsApp(orderWithDetails).catch((err: unknown) => {
        console.error("[checkout] failed to send order confirmation WhatsApp message:", err);
      });
      await notifyNewOrder({
        ...orderWithDetails,
        customerName: orderWithDetails.shippingAddress.fullName ?? "Customer",
        customerPhone: orderWithDetails.shippingAddress.phone ?? "",
      }).catch((err: unknown) => {
        console.error("[checkout] failed to fan out new-order admin notifications:", err);
      });

      return { checkoutUrl: confirmationUrl, orderId: order.id };
    }),

  /** Live shipping-rate preview for the cart/checkout pages (ADMIN_PANEL.md — "shipping configurable from admin") — same values createIntent will actually charge, so the storefront never shows a stale/hardcoded number. */
  getShippingRates: publicProcedure.query(async () => {
    return getShippingRates();
  }),

  /** Live cart-page preview — same rules as createIntent, no side effects. */
  previewDiscount: publicProcedure
    .input(z.object({ code: z.string().trim().min(1), subtotal: z.number().int().min(0) }))
    .query(async ({ ctx, input }) => {
      const discount = await validateDiscountCode(
        input.code,
        input.subtotal,
        ctx.customerSession?.userId ?? null,
      );
      return { amount: discount.amount, freeShipping: discount.freeShipping };
    }),

  /** Post-checkout confirmation page — access is the signed token, not a bare guessable order id. */
  getOrderByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyOrderAccessToken(input.token);
      if (!payload) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This link is invalid or has expired.",
        });
      }
      return getOrderForGuest(payload.orderId, payload.email);
    }),

  /** "Track your order" manual lookup (ORDER_MANAGEMENT.md §4) — order number + email issues a fresh access token. */
  lookupOrder: publicProcedure
    .input(z.object({ orderNumber: z.string().trim().min(1), email: z.string().trim().email() }))
    .mutation(async ({ input }) => {
      const order = await prisma.order.findUnique({
        where: { orderNumber: input.orderNumber.trim().toUpperCase() },
      });
      const genericError = new TRPCError({
        code: "NOT_FOUND",
        message: "No order found matching that order number and email.",
      });
      if (!order?.guestEmail) {
        throw genericError;
      }
      if (order.guestEmail.toLowerCase() !== input.email.toLowerCase()) {
        throw genericError;
      }
      const token = await signOrderAccessToken({ orderId: order.id, email: order.guestEmail });
      return { token };
    }),
});

async function getOrderForGuest(orderId: string, email: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shippingAddress: true,
      billingAddress: true,
      payment: true,
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order?.guestEmail) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
  }
  if (order.guestEmail.toLowerCase() !== email.toLowerCase()) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
  }
  return order;
}

function isUniqueOrderNumberConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002" &&
    "meta" in err &&
    JSON.stringify((err as { meta?: unknown }).meta).includes("order_number")
  );
}
