import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

// `buckets` is module-level singleton state (by design — it's a
// single-process in-memory limiter), so every test uses its own unique key
// to avoid bleeding into other tests in this file.
let keyCounter = 0;
function uniqueKey(): string {
  keyCounter += 1;
  return `test-key-${String(keyCounter)}`;
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first attempt and reports the remaining count", () => {
    const result = checkRateLimit(uniqueKey(), 5, 60_000);
    expect(result).toEqual({ allowed: true, remaining: 4, resetAt: 60_000 });
  });

  it("allows exactly up to the limit, then denies", () => {
    const key = uniqueKey();
    const limit = 3;

    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(true);

    const fourth = checkRateLimit(key, limit, 60_000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("keeps separate counters per key", () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();

    checkRateLimit(keyA, 1, 60_000);
    const secondOnA = checkRateLimit(keyA, 1, 60_000);
    const firstOnB = checkRateLimit(keyB, 1, 60_000);

    expect(secondOnA.allowed).toBe(false);
    expect(firstOnB.allowed).toBe(true);
  });

  it("resets the window once it elapses", () => {
    const key = uniqueKey();
    const limit = 1;

    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(false);

    vi.setSystemTime(60_001);

    const afterReset = checkRateLimit(key, limit, 60_000);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(limit - 1);
  });
});
