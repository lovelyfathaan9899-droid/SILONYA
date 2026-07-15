# SILONYA — Payment Architecture

Defines how SILONYA integrates with Stripe for payments, tax, and refunds. Payments are the highest-trust, highest-compliance domain in the platform — this document is binding, not advisory.

---

## 1. Principles

1. **We never touch raw card data.** Card details flow directly from the customer's browser to Stripe via Stripe Elements/Payment Element — SILONYA's servers only ever see a `PaymentIntent` ID and status, keeping us out of PCI-DSS SAQ D scope (SAQ A applies instead).
2. **Stripe is the source of truth for payment state**; our `Payment` table (DATABASE_ARCHITECTURE.md §3.5) is a synchronized reference, kept current via webhooks, never the authority we'd trust over Stripe in a conflict.
3. **All monetary amounts are computed server-side**, in integer minor units, and passed to Stripe — the client never supplies an amount that gets charged.
4. **Idempotency everywhere.** Every payment-affecting operation (creating an intent, processing a webhook) is idempotent, because networks retry and webhooks can be delivered more than once.

---

## 2. Payment Flow

```
apps/web (Checkout)              packages/api (checkout router)              Stripe
      │                                    │                                     │
      │  checkout.createIntent()           │                                     │
      ├───────────────────────────────────►│                                     │
      │                                     │  Validate cart, compute totals      │
      │                                     │  (ORDER_MANAGEMENT.md §3)           │
      │                                     │  Create PaymentIntent(amount, cur)  │
      │                                     ├────────────────────────────────────►│
      │                                     │◄────────────────────────────────────┤
      │                                     │   clientSecret, paymentIntentId     │
      │◄────────────────────────────────────┤                                     │
      │  { clientSecret, orderId }          │                                     │
      │                                     │                                     │
      │  Stripe.js confirmPayment(clientSecret)  ─────────────────────────────────►│
      │  (card details go directly to Stripe, never through our servers)          │
      │                                     │                                     │
      │                                     │        webhook: payment_intent.succeeded
      │                                     │◄────────────────────────────────────┤
      │                                     │  Verify signature, mark Order paid  │
      │                                     │  (idempotent on event.id)           │
      │  Redirect to confirmation page      │                                     │
      │◄────────────────────────────────────┤                                     │
```

**Key design decision:** order status becomes `paid` from the **webhook**, not from the client-side redirect after `confirmPayment()`. The client redirect is optimistic UX only — if a customer closes the tab mid-flow, the webhook still arrives and the order still completes correctly. Never trust client-reported payment success as authoritative.

---

## 3. Webhook Handling

Endpoint: `POST /api/v1/webhooks/stripe` (API_SPECIFICATION.md §3).

```
1. Read raw request body (required for signature verification — never parse before verifying)
2. Verify Stripe-Signature header against webhook secret
3. Check ProcessedWebhookEvent table for event.id — if already processed, return 200 immediately (idempotency)
4. Record event.id in ProcessedWebhookEvent
5. Enqueue event to BullMQ for async processing (route handler returns 200 fast, Stripe's retry
   window is generous but we don't want to hold the connection open for business logic)
6. Worker processes event by type:
     checkout.session.completed / payment_intent.succeeded → Order.status = paid, finalize inventory (ORDER_MANAGEMENT.md §3)
     payment_intent.payment_failed → Order.status = payment_failed, notify customer
     charge.refunded              → sync Refund record, update Order status
     charge.dispute.created        → flag order, alert admin team (chargeback risk)
```

> **Implementation status (Phase 6):** step 5's BullMQ enqueue doesn't exist yet (no Redis provisioned) — the route handler (`apps/web/app/api/v1/webhooks/stripe/route.ts`) processes the event synchronously in-request instead, calling `markOrderPaid`/`markOrderPaymentFailed` (`packages/api/src/services/order-fulfillment.ts`) directly. Steps 1-4 and the idempotency/signature guarantees are unchanged; only the queue hop is deferred. Checkout uses **Stripe Checkout Sessions** (TECH_STACK.md's "Checkout for launch" guidance), so the primary success signal is `checkout.session.completed`, not a bare `payment_intent.succeeded`.

**Signature verification is non-negotiable** — an unverified webhook is a forgeable "mark this order paid" endpoint, so every handler rejects unsigned/invalid requests before any processing.

---

## 4. Idempotency

- **PaymentIntent creation:** Stripe's `Idempotency-Key` header is set to the `Order.id`, so a network retry of `checkout.createIntent` can never create two PaymentIntents for the same order.
- **Webhook processing:** `ProcessedWebhookEvent(eventId unique)` ensures a redelivered webhook (Stripe explicitly recommends designing for this) is a no-op the second time.
- **Refund issuance:** idempotency key derived from `(orderId, refundReason, amount, adminActionTimestamp-truncated-to-minute)` to prevent accidental double-refund from a double admin click, while still allowing legitimate separate partial refunds.

---

## 5. Refunds

Full workflow context in [ORDER_MANAGEMENT.md](./ORDER_MANAGEMENT.md) §7. Payment-specific rules:

- Refunds are issued via Stripe's Refund API against the original `PaymentIntent` — never as a separate/manual money movement.
- Partial refunds are supported; cumulative refunded amount is validated (application + DB check constraint) to never exceed the original charge.
- Refund initiation requires `refunds:write` admin permission ([AUTHENTICATION.md](./AUTHENTICATION.md) §4) and is logged to `AuditLogEntry`.
- Refund status is synced back via the `charge.refunded` webhook, not assumed successful the moment the admin clicks the button.

---

## 6. Multi-Currency & Tax

- **Stripe Tax** computes tax at `checkout.createIntent` time based on the shipping address and product tax category — SILONYA does not maintain its own tax rate tables, avoiding the compliance burden of tracking global tax law directly.
- **Multi-currency (Phase 4):** Stripe natively supports charging in the customer's local currency; `Order.currency` and `Payment.currency` already exist in the schema (DATABASE_ARCHITECTURE.md) to support this without a schema change when Phase 4 activates it.

> **Implementation status (Phase 6):** Stripe Tax requires origin-address/tax-registration setup in the Stripe dashboard that isn't in place on this test account, so `checkout.createIntent` (`packages/api/src/routers/checkout/index.ts`) computes tax and shipping with a basic, explicitly-documented flat calculation instead (`packages/utils/src/order.ts` — flat shipping rate with a free-shipping threshold, flat percentage tax for one country). Swap the implementation behind `calculateShipping`/`calculateTax`, not their call sites, once Stripe Tax is configured.

---

## 7. Failure Handling

| Scenario                               | Handling                                                                                                                                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card declined                          | `payment_intent.payment_failed` webhook → Order → `payment_failed`, inventory reservation released (PRODUCT_SYSTEM.md §4.2 expiry sweep), customer sees a clear, specific decline message and can retry with a different method  |
| Customer abandons checkout mid-payment | Reservation expires via the scheduled sweep job (~15 min), order remains `pending_payment` indefinitely (harmless, unpurchased)                                                                                                  |
| Webhook delivery delayed/fails         | Stripe retries webhooks automatically for up to 3 days; additionally, a reconciliation job polls Stripe for any `PaymentIntent` older than 30 minutes still `pending_payment` in our DB, self-healing rare webhook delivery gaps |
| Duplicate webhook delivery             | No-op via `ProcessedWebhookEvent` (§3, §4)                                                                                                                                                                                       |
| Chargeback/dispute                     | `charge.dispute.created` webhook flags the order and alerts the admin team via a notification (Phase 2: email alert; Phase 3+: in-admin dashboard) — SILONYA responds to disputes through the Stripe dashboard directly          |

---

## 8. Security & Compliance

- **PCI-DSS:** SAQ A eligible — no cardholder data ever traverses or is stored on SILONYA infrastructure (Stripe Elements/Payment Element handles all card input).
- **Secrets:** Stripe secret key and webhook signing secret are environment variables, never committed, rotated on any suspected exposure (PROJECT_RULES.md §8).
- **Least privilege API keys:** restricted Stripe API keys are used per environment (test keys in preview/staging, live keys only in production), preventing a staging misconfiguration from touching real money.
- **Fraud:** Stripe Radar is enabled by default for real-time fraud scoring on every PaymentIntent; high-risk transactions can be configured to require additional verification (3D Secure) automatically.

Full cross-cutting security posture: [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md).

---

## 9. Future Expansion

- **Additional payment methods** (Apple Pay, Google Pay, buy-now-pay-later via Klarna/Afterpay) — all available through Stripe's Payment Element with no architectural change, enabled as business priorities dictate.
- **Store credit/gift cards** — would introduce a `StoreCredit` ledger consulted alongside Stripe at checkout (partial Stripe charge + partial credit redemption), noted as a future schema addition in ORDER_MANAGEMENT.md §12.
- **Marketplace/split payments** — explicitly out of scope; SILONYA's single-brand D2C model (README.md) means Stripe Connect's multi-party payout complexity is never needed.
