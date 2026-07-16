/**
 * In-memory fixed-window rate limiter — a documented stand-in for the
 * Redis-backed limiter SECURITY_ARCHITECTURE.md §3.5 specifies (Redis/
 * Upstash isn't provisioned in this environment, same deviation as
 * DATABASE_ARCHITECTURE.md §3.4's cart/session note and PAYMENT_ARCHITECTURE.md's
 * synchronous-webhook note). Works correctly for a single Node process;
 * does **not** share state across multiple serverless instances — replace
 * with Upstash's Redis-backed limiter before a multi-instance production
 * deploy, not before.
 */
interface WindowRecord {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowRecord>();

// Periodic cleanup so `buckets` doesn't grow unbounded over a long-running
// process — irrelevant on serverless (fresh process per invocation) but
// matters for `pnpm dev`/a persistent Node deploy.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of buckets) {
      if (record.resetAt < now) buckets.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** Fixed-window check-and-increment for `key` — call once per attempt. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
