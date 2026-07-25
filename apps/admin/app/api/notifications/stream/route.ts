import { getAdminContext } from "@/lib/admin-context";
import { prisma } from "@silonya/database";

/**
 * NOTIFICATION_ARCHITECTURE.md's realtime requirement ("notifications
 * appear instantly without refreshing the page") implemented as
 * Server-Sent Events rather than WebSockets — this app deploys as Vercel
 * serverless functions (no persistent Node process to hold a WebSocket
 * server open, and no Redis/pub-sub backend provisioned in this
 * environment to fan events out across function instances even if there
 * were). What this route actually does under the hood is poll
 * NotificationLog every few seconds and stream new rows down the open
 * connection; from the browser's perspective (EventSource auto-reconnects
 * on its own whenever a connection closes) this is indistinguishable from
 * a persistent push. The stream deliberately self-closes well under
 * typical Vercel function duration limits — the client reconnecting is the
 * intended steady state, not a failure.
 */
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 3000;
const MAX_STREAM_DURATION_MS = 25000;

export async function GET(): Promise<Response> {
  const ctx = await getAdminContext();
  if (!ctx.adminSession) {
    return new Response("Unauthorized", { status: 401 });
  }
  const adminUserId = ctx.adminSession.userId;

  const encoder = new TextEncoder();
  // An object property, not a plain `let` — a `let` gets over-eagerly
  // narrowed by TS across the `await` points below (it can't see the
  // `cancel()` callback reassigning it asynchronously), which trips
  // @typescript-eslint/no-unnecessary-condition as a false positive.
  const state = { cancelled: false };

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let cursor = new Date();

      function send(event: string, data: unknown): void {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("connected", { at: cursor.toISOString() });

      while (!state.cancelled && Date.now() - startedAt < MAX_STREAM_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const fresh = await prisma.notificationLog.findMany({
          where: { adminUserId, channel: "dashboard", createdAt: { gt: cursor } },
          orderBy: { createdAt: "asc" },
          take: 20,
        });

        if (fresh.length > 0) {
          const last = fresh[fresh.length - 1];
          if (last) cursor = last.createdAt;
          for (const notification of fresh) {
            send("notification", notification);
          }
        }
      }

      if (!state.cancelled) {
        controller.close();
      }
    },
    cancel() {
      state.cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
