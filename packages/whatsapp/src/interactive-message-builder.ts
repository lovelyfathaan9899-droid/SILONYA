/**
 * Confirm/Cancel are Quick Reply buttons baked into the `order_confirmation`
 * template at Meta approval time; only the *payload* each button carries is
 * dynamic per send (Meta supports a per-message payload override on a
 * template's quick-reply button component). The payload string is how the
 * webhook handler identifies which order + action a button tap refers to
 * without a DB lookup keyed on the button's (fixed, non-unique) label text.
 *
 * Help is a URL button, not a quick reply — it deep-links straight to
 * wa.me with a pre-filled message, so it needs no webhook handling at all
 * (WHATSAPP_MESSAGE spec: "Open WhatsApp conversation with customer
 * support").
 */

const CONFIRM_PREFIX = "CONFIRM_ORDER_";
const CANCEL_PREFIX = "CANCEL_ORDER_";

export function buildConfirmPayload(orderId: string): string {
  return `${CONFIRM_PREFIX}${orderId}`;
}

export function buildCancelPayload(orderId: string): string {
  return `${CANCEL_PREFIX}${orderId}`;
}

export interface ParsedButtonPayload {
  action: "confirm" | "cancel";
  orderId: string;
}

/** Inverse of buildConfirmPayload/buildCancelPayload — used by the webhook handler on an inbound button-reply event. Returns null for anything that isn't one of our own button payloads (defensive against malformed/foreign payloads). */
export function parseButtonPayload(payload: string): ParsedButtonPayload | null {
  if (payload.startsWith(CONFIRM_PREFIX)) {
    const orderId = payload.slice(CONFIRM_PREFIX.length);
    return orderId ? { action: "confirm", orderId } : null;
  }
  if (payload.startsWith(CANCEL_PREFIX)) {
    const orderId = payload.slice(CANCEL_PREFIX.length);
    return orderId ? { action: "cancel", orderId } : null;
  }
  return null;
}

/**
 * A `wa.me` deep link with a pre-filled message — tapping it opens the
 * customer's WhatsApp app with a new conversation to `supportPhone`
 * (E.164, no leading "+") and the message box already populated. No API
 * call, no webhook — this is a plain link, not a Cloud API feature.
 */
export function buildHelpWaLink(supportPhone: string, orderNumber: string): string {
  const message = `Hello SILONYA, I need help regarding Order ${orderNumber}.`;
  return `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
}
