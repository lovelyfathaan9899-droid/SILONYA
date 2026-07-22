import { releaseExpiredReservations } from "@silonya/api";
import { NextResponse } from "next/server";

/**
 * Cleanup endpoint for packages/api/src/services/order-fulfillment.ts's
 * releaseExpiredReservations — see that function's doc comment for why
 * this exists and the deviation from DEPLOYMENT.md §1's originally-specified
 * BullMQ worker.
 *
 * Not on an automatic Vercel Cron schedule right now — apps/web/vercel.json
 * intentionally declares no `crons` entry. It originally ran every 5
 * minutes, which the Hobby plan doesn't support (Hobby cron jobs are
 * limited to once-per-day invocations); rather than degrade correctness by
 * dropping to a daily sweep, this endpoint is left schedule-agnostic so
 * it works the same regardless of how it's triggered. To re-enable
 * automatic triggering:
 *   - **On a paid Vercel plan**: add a `crons` entry back to
 *     apps/web/vercel.json, e.g. `{ "path": "/api/cron/release-expired-reservations",
 *     "schedule": "*\/5 * * * *" }` for every-5-minutes, or any schedule the
 *     plan supports.
 *   - **Staying on Hobby**: an external scheduler (a GitHub Actions cron
 *     workflow, cron-job.org, etc.) can call this same URL on whatever
 *     interval you like — nothing here is Vercel-specific except how the
 *     request gets triggered.
 *   - **Ad hoc**: `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/release-expired-reservations`
 *     any time — the endpoint is idempotent and only ever touches orders
 *     already 15+ minutes stale, so there's no harm in calling it manually
 *     or from multiple sources.
 *
 * Whatever calls it, `Authorization: Bearer $CRON_SECRET` is required
 * (Vercel Cron sends this automatically on scheduled invocations —
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs —
 * anything else must set the header itself). If CRON_SECRET isn't
 * configured at all, every request is rejected — this is a runtime check
 * only (`process.env` read inside the handler), so a missing/unset secret
 * never affects the build.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await releaseExpiredReservations();
  return NextResponse.json({ success: true, ...result });
}
