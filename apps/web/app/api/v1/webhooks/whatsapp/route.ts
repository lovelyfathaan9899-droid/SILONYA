import { processWhatsAppWebhookPayload } from "@silonya/api";
import { verifyWhatsAppSignature, verifyWhatsAppSubscribeChallenge } from "@silonya/whatsapp";
import { NextResponse } from "next/server";

/**
 * WHATSAPP_ARCHITECTURE.md — Meta's Cloud API webhook. Two verbs:
 *
 * GET — the one-time (and any re-verification) subscribe handshake Meta
 * performs when this URL is registered in the App Dashboard.
 *
 * POST — every subsequent event (delivery/read receipts, inbound button
 * taps). Signature-verified against the *raw* body before any parsing
 * (SECURITY spec), idempotent via processWhatsAppWebhookPayload's own
 * per-event ProcessedWebhookEvent guard (same pattern as
 * apps/web/app/api/v1/webhooks/stripe). Always returns 200 once the
 * signature check passes — Meta interprets non-2xx as "retry this
 * delivery," and since processing is already idempotent, there's no
 * correctness reason to ever make Meta retry a payload we successfully
 * read; a per-event processing failure is logged, not surfaced as an HTTP
 * error for the whole batch.
 */
export function GET(request: Request): NextResponse {
  const { searchParams } = new URL(request.url);
  const result = verifyWhatsAppSubscribeChallenge(searchParams);
  if (!result) {
    return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  }
  return new NextResponse(result.challenge, { status: 200 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    await processWhatsAppWebhookPayload(parsed);
  } catch (err) {
    console.error("[whatsapp webhook] processing failed:", err);
  }

  return NextResponse.json({ received: true });
}
