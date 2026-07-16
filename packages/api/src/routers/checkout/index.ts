import { signOrderAccessToken, verifyOrderAccessToken } from "@silonya/auth";
import { prisma } from "@silonya/database";
import { sendOrderConfirmationEmail } from "@silonya/emails";
import { calculateShipping, calculateTax, generateOrderNumber } from "@silonya/utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDefaultWarehouseId } from "../admin-catalog/shared";
import { publicProcedure, router } from "../../trpc";
import { getStripeClient } from "../../lib/stripe";
import { checkRateLimit } from "../../lib/rate-limit";
import { siteUrl } from "../../lib/site-url";
import { toOrderEmailData } from "../../lib/order-email-mapper";
import { finalizeReservation, releaseReservation } from "../../services/inventory";
import { findRedeemableGiftCard } from "../gift-cards";
import {
  CURRENCY,
  findAutomaticDiscount,
  toAddressCreateInput,
  validateDiscountCode,
  variantLabel,
} from "./shared";

const addressInput = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().min(1),
  countryCode: z.string().trim().length(2),
  phone: z.string().trim().optional(),
});

const MAX_RETRY_ON_ORDER_NUMBER_COLLISION = 3;

export const checkoutRouter = router({
  /**
   * ORDER_MANAGEMENT.md §3 — the entire checkout-to-payment-intent flow in
   * one procedure: re-validate cart against live data, reserve inventory,
   * create the Order (pending_payment), then create a Stripe Checkout
   * Session and return its hosted URL. The DB transaction and the Stripe
   * call are deliberately sequential, not nested — Stripe is a network
   * call and can't participate in a Postgres transaction; if it fails
   * after the DB commit, the reservation is released and the order
   * cancelled explicitly (see catch block below) rather than left stuck.
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      const shippingTotal = calculateShipping(subtotal, discount?.freeShipping ?? false);
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
              const affected = await tx.$executeRaw`
              UPDATE inventory
              SET quantity_reserved = quantity_reserved + ${item.quantity}
              WHERE variant_id = ${item.variantId}
                AND warehouse_id = ${warehouseId}
                AND quantity_on_hand - quantity_reserved >= ${item.quantity}
            `;
              if (affected === 0) {
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

            const createdOrder = await tx.order.create({
              data: {
                orderNumber: generateOrderNumber(),
                userId,
                guestEmail: input.guestEmail,
                status: "pending_payment",
                subtotal,
                shippingTotal,
                taxTotal,
                discountTotal: discount?.amount ?? 0,
                giftCardTotal: giftCardApplied,
                grandTotal,
                currency: CURRENCY,
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

            // Fully covered by discount/gift card — nothing left to charge,
            // so there's no Stripe PaymentIntent to wait on. Finalize the
            // reservation and mark the order paid inline, mirroring what the
            // webhook does for a paid Stripe order (services/order-fulfillment.ts).
            if (grandTotal === 0) {
              await finalizeReservation(tx, createdOrder.items, warehouseId);
              await tx.order.update({
                where: { id: createdOrder.id },
                data: { status: "paid", placedAt: new Date() },
              });
              await tx.orderStatusEvent.create({
                data: {
                  orderId: createdOrder.id,
                  status: "paid",
                  triggeredBy: "system",
                  note: "Fully covered by discount/gift card — no payment required.",
                },
              });
            }

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

      // Fully covered by discount/gift card — no Stripe session to create;
      // the order was already marked paid inside the transaction above.
      if (grandTotal === 0) {
        const orderWithDetails = await prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true, shippingAddress: true, billingAddress: true },
        });
        const emailData = toOrderEmailData(orderWithDetails, confirmationUrl);
        if (emailData) {
          await sendOrderConfirmationEmail(emailData).catch((err: unknown) => {
            console.error("[checkout] failed to send order confirmation email:", err);
          });
        }
        return { checkoutUrl: confirmationUrl, orderId: order.id };
      }

      try {
        const stripe = getStripeClient();

        const totalReduction = (discount?.amount ?? 0) + giftCardApplied;
        let discounts: { coupon: string }[] | undefined;
        if (totalReduction > 0) {
          const couponName =
            discount && giftCardApplied > 0
              ? "Discount & gift card"
              : giftCardApplied > 0
                ? "Gift card"
                : (input.discountCode ?? "Discount");
          const coupon = await stripe.coupons.create(
            {
              amount_off: totalReduction,
              currency: CURRENCY.toLowerCase(),
              duration: "once",
              name: couponName,
            },
            { idempotencyKey: `coupon_${order.id}` },
          );
          discounts = [{ coupon: coupon.id }];
        }

        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            customer_email: input.guestEmail,
            ...(discounts ? { discounts } : {}),
            line_items: [
              ...order.items.map((item) => ({
                price_data: {
                  currency: CURRENCY.toLowerCase(),
                  product_data: {
                    name: item.variantLabelSnapshot
                      ? `${item.productNameSnapshot} (${item.variantLabelSnapshot})`
                      : item.productNameSnapshot,
                  },
                  unit_amount: item.unitPrice,
                },
                quantity: item.quantity,
              })),
              ...(shippingTotal > 0
                ? [
                    {
                      price_data: {
                        currency: CURRENCY.toLowerCase(),
                        product_data: { name: "Shipping" },
                        unit_amount: shippingTotal,
                      },
                      quantity: 1,
                    },
                  ]
                : []),
              ...(taxTotal > 0
                ? [
                    {
                      price_data: {
                        currency: CURRENCY.toLowerCase(),
                        product_data: { name: "Tax" },
                        unit_amount: taxTotal,
                      },
                      quantity: 1,
                    },
                  ]
                : []),
            ],
            success_url: confirmationUrl,
            cancel_url: `${siteUrl()}/checkout?cancelled=1`,
            metadata: { orderId: order.id },
            payment_intent_data: { metadata: { orderId: order.id } },
          },
          { idempotencyKey: order.id },
        );

        await prisma.payment.create({
          data: {
            orderId: order.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? session.id),
            status: "requires_action",
            amount: grandTotal,
            currency: CURRENCY,
          },
        });

        return { checkoutUrl: session.url ?? `${siteUrl()}/checkout`, orderId: order.id };
      } catch (err) {
        await releaseOrderReservation(order.id, warehouseId);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to start payment. Please try again.",
        });
      }
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

async function releaseOrderReservation(orderId: string, warehouseId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    await releaseReservation(tx, items, warehouseId);
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        status: "cancelled",
        triggeredBy: "system",
        note: "Stripe Checkout Session creation failed; reservation released.",
      },
    });
  });
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
