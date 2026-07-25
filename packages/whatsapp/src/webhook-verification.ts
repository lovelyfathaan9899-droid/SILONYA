import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta's webhook subscribe handshake (GET) — Meta calls this once when the
 * webhook URL is registered in the App Dashboard, and again any time the
 * subscription is re-verified. Must echo back `hub.challenge` verbatim,
 * and only when `hub.verify_token` matches our own secret — anyone who
 * doesn't know WHATSAPP_WEBHOOK_VERIFY_TOKEN gets rejected rather than a
 * free echo.
 */
export function verifyWhatsAppSubscribeChallenge(
  params: URLSearchParams,
): { challenge: string } | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode !== "subscribe" || !challenge || !expectedToken || token !== expectedToken) {
    return null;
  }
  return { challenge };
}

/**
 * SECURITY spec's "Verify Meta webhook signatures" — every POST carries an
 * `X-Hub-Signature-256: sha256=<hex>` header, an HMAC-SHA256 of the *raw*
 * request body keyed by the app secret (WHATSAPP_APP_SECRET, from Meta
 * App Dashboard → Settings → Basic, not the access token). Must run against
 * the raw bytes before any JSON.parse — re-serializing a parsed body can
 * produce different bytes (key order, whitespace) and silently break
 * verification. `timingSafeEqual` avoids leaking how many leading bytes
 * matched via response-time differences.
 */
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
