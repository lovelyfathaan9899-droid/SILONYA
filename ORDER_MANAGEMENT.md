# SILONYA — Order Management

Describes the order lifecycle from cart to fulfillment to post-purchase service, built on [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) §3.4–3.6 and integrating with [PAYMENT_ARCHITECTURE.md](./PAYMENT_ARCHITECTURE.md).

---

## 1. Order Lifecycle Overview

```
Cart → Checkout → Payment → Confirmed → Fulfillment → Shipped → Delivered
                                  │
                                  ├──► Cancelled (pre-fulfillment)
                                  └──► Refunded / Partially Refunded (any point post-payment)
```

## 2. Order Status State Machine

`Order.status` enum and valid transitions — enforced in `admin.orders.updateStatus` and the checkout flow; **no transition outside this graph is permitted**, and every transition is written to `OrderStatusEvent`.

| Status                            | Meaning                                      | Valid next states                                                                  |
| --------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pending_payment`                 | Order created, awaiting payment confirmation | `paid`, `payment_failed`, `cancelled`                                              |
| `payment_failed`                  | Payment declined/errored                     | `pending_payment` (retry), `cancelled`                                             |
| `paid`                            | Payment captured, inventory finalized        | `processing`, `cancelled` (pre-fulfillment cancellation)                           |
| `processing`                      | Being picked/packed (warehouse)              | `shipped`, `cancelled` (exceptional, e.g. damaged stock found)                     |
| `shipped`                         | Carrier has the package                      | `delivered`, `returned`                                                            |
| `delivered`                       | Carrier confirms delivery                    | `returned` (within return window)                                                  |
| `cancelled`                       | Order terminated before fulfillment          | _(terminal)_                                                                       |
| `returned`                        | Customer-initiated return received           | `refunded`                                                                         |
| `refunded` / `partially_refunded` | Money returned                               | _(terminal, though partial can receive further partial refunds up to full amount)_ |

Transitions triggered by: customer action (cancel while `pending_payment`), Stripe webhook (`paid`/`payment_failed`), admin action (`processing`→`shipped` on fulfillment, refunds), or carrier webhook (`shipped`→`delivered`, Phase 4).

---

## 3. Checkout → Order Creation Flow

```
1. Customer reviews cart, proceeds to checkout
2. Shipping/billing address collected, shipping method selected
3. checkout.createIntent:
     a. Re-validate every cart item's price + availability against live DB (never trust cart snapshot)
     b. Begin DB transaction:
          - Reserve inventory (ORDER: PRODUCT_SYSTEM.md §4.2)
          - Compute subtotal, tax (Stripe Tax), shipping, discount, grand total server-side
          - Create Order (status: pending_payment) + OrderItems (snapshotted data)
          - Create Stripe PaymentIntent for grandTotal
          - Create Payment row linking Order ↔ PaymentIntent
     c. Commit transaction
4. Client completes payment via Stripe Elements using the returned clientSecret
5. Stripe webhook confirms payment → Order status: paid (see PAYMENT_ARCHITECTURE.md §3)
6. Order confirmation email sent (Resend), confirmation page shown
7. Reservation finalized: quantityOnHand decremented, quantityReserved released (PRODUCT_SYSTEM.md §4.2)
```

**Critical rule:** step 3a re-validates against the database, not the cart's cached snapshot — a price change or stock depletion between "add to cart" and "checkout" is always caught here, never silently honored at a stale price.

---

## 4. Guest vs. Authenticated Orders

- Guest orders store `guestEmail` directly on `Order`; no `User` row is created.
- Order status/tracking for guests is accessed via a signed, expiring lookup link (order number + email) sent in the confirmation email — no password required, no permanent account forced.
- If a guest later creates an account with the same email, past guest orders are linked retroactively (`Order.userId` backfilled) after email ownership is verified — visible in account order history from that point on. **Implemented (Phase 8+9):** `customerAuth.register` does this backfill in the same transaction as account creation (case-insensitive email match against `Order.guestEmail`); "email ownership verified" here means the registrant proved control of the address by successfully creating the password-protected account with it, not a separate confirmation step.

---

## 5. Fulfillment

- MVP (Phase 2): fulfillment status is updated manually by staff in the admin (`processing` → `shipped`) with tracking number entry, notifying the customer via email on each transition.
- Phase 4: carrier integration (Shippo/EasyPost) automates rate shopping and label generation; carrier webhooks automate `shipped` → `delivered` transitions instead of manual entry.
- Partial fulfillment (shipping part of an order before the rest is ready) is **out of scope for MVP** — an order ships as a single unit at launch; multi-shipment orders are a Phase 4+ consideration once multi-warehouse inventory exists.

---

## 6. Cancellations

- Customer-initiated cancellation is allowed only while `status = pending_payment` or, with admin approval, `paid`-but-not-yet-`processing` — once fulfillment has begun, it becomes a return instead.
- Cancelling a `paid` order triggers an automatic full refund (PAYMENT_ARCHITECTURE.md §5) and releases any inventory that was finalized.

---

## 7. Returns & Refunds

```
Customer requests return (within policy window, e.g. 30 days of delivery)
        │
        ▼
Admin/self-service return request created, status: returned (pending inspection)
        │
        ▼
Returned item received/inspected by staff
        │
        ▼
Refund issued via Stripe (full or partial) ── Refund row created, linked to Payment
        │
        ▼
Order status: refunded / partially_refunded
        │
        ▼
Inventory optionally restocked (admin decision — damaged returns are not restocked)
```

- Refund amount is always ≤ original payment amount, enforced at the database (check constraint on cumulative refunds) and application layer.
- Self-service return initiation (customer-facing, no admin intervention needed for standard cases) is a Phase 3 feature; MVP handles returns via customer support + admin-initiated refund.

---

## 8. Discounts at Checkout

- A discount code is validated against `Discount` rules (active window, usage limits, minimum subtotal) and `DiscountRedemption` history (per-user limit) inside the same checkout transaction as order creation — never validated in isolation and trusted moments later, closing a race-condition window where a limited code could be over-redeemed by concurrent checkouts.
- Discount amount is computed server-side and stored on the `Order` (`discountTotal`) as a snapshot — subsequent changes to the `Discount` record never retroactively alter a placed order.

---

## 9. Notifications

Transactional emails (Resend + React Email, TECH_STACK.md) sent on: order confirmation, payment failed, shipped (with tracking), delivered, cancelled, refund issued. Each is triggered by the corresponding `OrderStatusEvent` write, via a BullMQ job — decoupled from the request path so email delivery latency never blocks the checkout response.

---

## 10. Admin Order Operations

Full admin UX detail in [ADMIN_PANEL.md](./ADMIN_PANEL.md) §4. Core capabilities: search/filter orders (by number, customer, status, date range), view full order detail + status history + audit trail, update fulfillment status, issue full/partial refunds, add internal notes (staff-only, never customer-visible), resend confirmation emails.

---

## 11. Analytics & Reporting Hooks

Every status transition and the order's full lifecycle timestamps feed into: fulfillment SLA reporting (time in each status), revenue reporting (by day/collection/category), refund-rate monitoring (a rising refund rate on a specific product is a quality signal surfaced to merchandising). These are read-model queries against the same tables — no separate data warehouse required until Phase 5 analytics needs exceed what Postgres read replicas comfortably serve.

---

## 12. Future Expansion

- **Split/multi-shipment orders** for multi-warehouse fulfillment (Phase 4).
- **Subscription/recurring orders** — not on the current roadmap, but the `Order`/`Payment` separation (rather than conflating them) means recurring billing could be layered on without restructuring core tables.
- **Store credit / gift cards** — modeled as a `StoreCredit` ledger tied to `User`, additive to the schema, considered for Phase 3–5 depending on business priority.
