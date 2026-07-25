import { processWhatsAppRetryQueue } from "@silonya/api";
import { NextResponse } from "next/server";

/**
 * RetryQueue's sweep endpoint (WHATSAPP_ARCHITECTURE.md) — same
 * schedule-agnostic design as
 * apps/web/app/api/cron/release-expired-reservations for the same reason
 * (Vercel Hobby plan's cron only supports once-daily invocations, and the
 * WhatsApp retry backoff needs a much tighter interval — 1/5/15/60
 * minutes). Not wired into apps/web/vercel.json's `crons` array by
 * default; to actually run on a schedule:
 *   - **On a paid Vercel plan**: add `{ "path":
 *     "/api/cron/process-whatsapp-queue", "schedule": "*\/5 * * * *" }` (or
 *     tighter) to vercel.json.
 *   - **Staying on Hobby**: call this URL from an external scheduler
 *     (GitHub Actions cron workflow, cron-job.org, etc.) every 1-5 minutes.
 *   - **Ad hoc**: `curl -H "Authorization: Bearer $CRON_SECRET"
 *     https://.../api/cron/process-whatsapp-queue` any time — idempotent,
 *     only touches messages whose nextRetryAt has already passed.
 *
 * `Authorization: Bearer $CRON_SECRET` required, same as the reservation
 * sweep — reuses the same env var rather than a WhatsApp-specific one,
 * since both are "is this really Vercel Cron / our own scheduler calling
 * this" checks with identical trust requirements.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processWhatsAppRetryQueue();
  return NextResponse.json({ success: true, ...result });
}
