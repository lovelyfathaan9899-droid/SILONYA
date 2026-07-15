"use client";

import {
  Badge,
  Button,
  Container,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@silonya/ui";
import { formatPriceForDisplay } from "@silonya/utils";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded"
  | "partially_refunded";

// Mirrors packages/api/src/routers/admin-orders/shared.ts's VALID_TRANSITIONS
// — duplicated here only to drive which options the Select offers; the
// server re-validates independently and is the actual source of truth.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: ["refunded"],
  refunded: [],
  partially_refunded: [],
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "outline" | "accent" | "success" | "error"> =
  {
    pending_payment: "outline",
    payment_failed: "error",
    paid: "accent",
    processing: "outline",
    shipped: "accent",
    delivered: "success",
    cancelled: "default",
    returned: "outline",
    refunded: "default",
    partially_refunded: "default",
  };

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function UpdateStatusPanel({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);

  const nextStatuses = VALID_TRANSITIONS[currentStatus];

  const updateStatus = trpc.adminOrders.updateStatus.useMutation({
    onSuccess: async () => {
      toast({ title: "Order updated" });
      setStatus("");
      setTrackingNumber("");
      setCarrier("");
      setNote("");
      await utils.adminOrders.getById.invalidate({ id: orderId });
    },
    onError: (error) => {
      toast({ title: "Couldn't update order", description: error.message, variant: "error" });
    },
  });

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <div className="border-mist flex flex-col gap-3 border p-4">
      <h2 className="font-display text-ink text-lg">Update status</h2>
      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value as OrderStatus);
        }}
      >
        <SelectTrigger aria-label="New status">
          <SelectValue placeholder="Choose a status…" />
        </SelectTrigger>
        <SelectContent>
          {nextStatuses.map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {status === "shipped" ? (
        <>
          <div>
            <Label htmlFor="tracking-number">Tracking number</Label>
            <Input
              id="tracking-number"
              value={trackingNumber}
              onChange={(event) => {
                setTrackingNumber(event.target.value);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="carrier">Carrier (optional)</Label>
            <Input
              id="carrier"
              value={carrier}
              onChange={(event) => {
                setCarrier(event.target.value);
              }}
              placeholder="UPS, FedEx, USPS…"
              className="mt-1"
            />
          </div>
        </>
      ) : null}

      {status === "cancelled" ? (
        <label className="text-ink flex items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            checked={restock}
            onChange={(event) => {
              setRestock(event.target.checked);
            }}
          />
          Restock items
        </label>
      ) : null}

      <div>
        <Label htmlFor="status-note">Note (optional)</Label>
        <Textarea
          id="status-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          rows={2}
          className="mt-1"
        />
      </div>

      <Button
        disabled={
          !status || (status === "shipped" && !trackingNumber.trim()) || updateStatus.isPending
        }
        onClick={() => {
          if (!status) return;
          updateStatus.mutate({
            id: orderId,
            status,
            restock,
            ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
            ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          });
        }}
      >
        {updateStatus.isPending ? "Updating…" : "Update status"}
      </Button>
    </div>
  );
}

function RefundDialog({
  orderId,
  remaining,
  currency,
}: {
  orderId: string;
  remaining: number;
  currency: string;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const issueRefund = trpc.adminOrders.issueRefund.useMutation({
    onSuccess: async () => {
      toast({ title: "Refund issued" });
      setOpen(false);
      setAmount("");
      setReason("");
      await utils.adminOrders.getById.invalidate({ id: orderId });
    },
    onError: (error) => {
      toast({ title: "Refund failed", description: error.message, variant: "error" });
    },
  });

  const amountMinorUnits = Math.round(Number.parseFloat(amount || "0") * 100);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={remaining <= 0}>
          Issue refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue refund</DialogTitle>
          <DialogDescription>
            Up to {formatPriceForDisplay(remaining, currency)} remains refundable on this order.
            This charges the refund directly to the customer&apos;s original payment method via
            Stripe.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="refund-amount">Amount ({currency})</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              rows={2}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={
              amountMinorUnits <= 0 ||
              amountMinorUnits > remaining ||
              reason.trim().length === 0 ||
              issueRefund.isPending
            }
            onClick={() => {
              issueRefund.mutate({ orderId, amount: amountMinorUnits, reason: reason.trim() });
            }}
          >
            {issueRefund.isPending ? "Issuing…" : "Issue refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddNoteForm({ orderId }: { orderId: string }) {
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");

  const addNote = trpc.adminOrders.addNote.useMutation({
    onSuccess: async () => {
      setBody("");
      await utils.adminOrders.getById.invalidate({ id: orderId });
    },
    onError: (error) => {
      toast({ title: "Couldn't add note", description: error.message, variant: "error" });
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        placeholder="Internal note — never shown to the customer…"
        rows={2}
      />
      <Button
        variant="secondary"
        className="w-fit"
        disabled={body.trim().length === 0 || addNote.isPending}
        onClick={() => {
          addNote.mutate({ orderId, body: body.trim() });
        }}
      >
        {addNote.isPending ? "Adding…" : "Add note"}
      </Button>
    </div>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const utils = trpc.useUtils();
  const query = trpc.adminOrders.getById.useQuery({ id: orderId });

  const resendEmail = trpc.adminOrders.resendConfirmationEmail.useMutation({
    onSuccess: () => {
      toast({ title: "Confirmation email sent" });
    },
    onError: (error) => {
      toast({ title: "Couldn't send email", description: error.message, variant: "error" });
    },
  });

  if (query.isLoading) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <LoadingState label="Loading order" />
        </Container>
      </Section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Section spacing="lg" tone="transparent" container={false}>
        <Container>
          <ErrorState
            title="Couldn't load order"
            description={query.error?.message}
            action={
              <Button
                onClick={() => {
                  void utils.adminOrders.getById.invalidate({ id: orderId });
                }}
              >
                Try again
              </Button>
            }
          />
        </Container>
      </Section>
    );
  }

  const order = query.data;
  const alreadyRefunded = order.payment?.refunds.reduce((sum, r) => sum + r.amount, 0) ?? 0;
  const remaining = (order.payment?.amount ?? 0) - alreadyRefunded;

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-2xl">{order.orderNumber}</h1>
            <div className="mt-1 flex items-center gap-3">
              <Badge variant={STATUS_BADGE_VARIANT[order.status] ?? "default"}>
                {statusLabel(order.status)}
              </Badge>
              <span className="text-stone font-sans text-sm">{order.guestEmail}</span>
            </div>
          </div>
          <Button
            variant="secondary"
            disabled={resendEmail.isPending}
            onClick={() => {
              resendEmail.mutate({ orderId });
            }}
          >
            {resendEmail.isPending ? "Sending…" : "Resend confirmation email"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-8 lg:col-span-2">
            <div className="border-mist border p-4">
              <h2 className="font-display text-ink mb-3 text-lg">Items</h2>
              <ul className="flex flex-col gap-2">
                {order.items.map((item) => (
                  <li key={item.id} className="text-ink flex justify-between font-sans text-sm">
                    <span>
                      {item.productNameSnapshot}
                      {item.variantLabelSnapshot ? ` (${item.variantLabelSnapshot})` : ""} ×{" "}
                      {item.quantity}
                    </span>
                    <span>{formatPriceForDisplay(item.lineTotal, order.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-mist text-ink mt-3 flex flex-col gap-1 border-t pt-3 font-sans text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPriceForDisplay(order.subtotal, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatPriceForDisplay(order.shippingTotal, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatPriceForDisplay(order.taxTotal, order.currency)}</span>
                </div>
                {order.discountTotal > 0 ? (
                  <div className="flex justify-between">
                    <span>Discount{order.discount?.code ? ` (${order.discount.code})` : ""}</span>
                    <span>-{formatPriceForDisplay(order.discountTotal, order.currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatPriceForDisplay(order.grandTotal, order.currency)}</span>
                </div>
              </div>
            </div>

            <UpdateStatusPanel orderId={orderId} currentStatus={order.status} />

            <div className="border-mist border p-4">
              <h2 className="font-display text-ink mb-3 text-lg">Status history</h2>
              <ul className="flex flex-col gap-3">
                {order.statusEvents.map((event) => (
                  <li key={event.id} className="text-ink font-sans text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[event.status] ?? "default"}>
                        {statusLabel(event.status)}
                      </Badge>
                      <span className="text-stone text-xs">
                        {new Date(event.createdAt).toLocaleString()} · {event.triggeredBy}
                        {event.adminUser ? ` · ${event.adminUser.email}` : ""}
                      </span>
                    </div>
                    {event.note ? <p className="text-stone mt-1 text-xs">{event.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-mist border p-4">
              <h2 className="font-display text-ink mb-3 text-lg">Staff notes</h2>
              <ul className="mb-4 flex flex-col gap-3">
                {order.notes.map((note) => (
                  <li key={note.id} className="text-ink font-sans text-sm">
                    <p>{note.body}</p>
                    <p className="text-stone text-xs">
                      {note.adminUser.email} · {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
              <AddNoteForm orderId={orderId} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="border-mist border p-4">
              <h2 className="font-display text-ink mb-2 text-lg">Payment</h2>
              {order.payment ? (
                <div className="text-ink flex flex-col gap-2 font-sans text-sm">
                  <div className="flex justify-between">
                    <span>Status</span>
                    <Badge>{statusLabel(order.payment.status)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount</span>
                    <span>{formatPriceForDisplay(order.payment.amount, order.currency)}</span>
                  </div>
                  {order.payment.refunds.length > 0 ? (
                    <div className="border-mist mt-2 border-t pt-2">
                      <p className="text-stone mb-1 text-xs uppercase tracking-wide">Refunds</p>
                      {order.payment.refunds.map((refund) => (
                        <div key={refund.id} className="flex justify-between text-xs">
                          <span>{refund.reason ?? "Refund"}</span>
                          <span>{formatPriceForDisplay(refund.amount, order.currency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <RefundDialog orderId={orderId} remaining={remaining} currency={order.currency} />
                </div>
              ) : (
                <p className="text-stone font-sans text-sm">No payment on file.</p>
              )}
            </div>

            {order.trackingNumber ? (
              <div className="border-mist border p-4">
                <h2 className="font-display text-ink mb-2 text-lg">Tracking</h2>
                <p className="text-ink font-sans text-sm">
                  {order.carrier ? `${order.carrier} — ` : ""}
                  {order.trackingNumber}
                </p>
              </div>
            ) : null}

            <div className="border-mist border p-4">
              <h2 className="font-display text-ink mb-2 text-lg">Shipping address</h2>
              <p className="text-ink font-sans text-sm">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? (
                  <>
                    <br />
                    {order.shippingAddress.line2}
                  </>
                ) : null}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.region ?? ""}{" "}
                {order.shippingAddress.postalCode}
                <br />
                {order.shippingAddress.countryCode}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
