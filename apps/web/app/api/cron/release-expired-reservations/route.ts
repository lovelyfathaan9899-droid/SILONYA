import { releaseExpiredReservations } from "@silonya/api";
import { NextResponse } from "next/server";

/**
 * Vercel Cron endpoint (apps/web/vercel.json's schedule) for
 * packages/api/src/services/order-fulfillment.ts's releaseExpiredReservations
 * — see that function's doc comment for why this exists and the deviation
 * from DEPLOYMENT.md §1's originally-specified BullMQ worker.
 *
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
 * scheduled invocations (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
 * — verified here so this endpoint can't be triggered by an arbitrary
 * public request (it's idempotent and only ever touches orders already
 * 15+ minutes stale, so abuse risk is low regardless, but there's no
 * reason to leave it open).
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
