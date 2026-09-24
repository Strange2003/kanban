/**
 * FR-038 of 011-agent-access-mcp: a token bucket per agent connection
 * (user + OAuth client), kept in memory. The instance runs as a single
 * process on Render, so this is exact there; with several instances it
 * becomes a per-instance limit, which still protects each one (research.md §
 * Límite de velocidad). It never touches the web UI — only /api/mcp calls it.
 */

const CAPACITY = 30; // burst
const REFILL_PER_SECOND = 120 / 60; // 120 calls a minute, sustained
const IDLE_EVICT_MS = 10 * 60 * 1000;

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateLimitOutcome = { ok: true } | { ok: false; retryAfterSeconds: number };

export function consumeRateLimit(key: string, now: number = Date.now()): RateLimitOutcome {
  // Lazy cleanup so idle connections don't accumulate forever.
  if (now - lastSweep > IDLE_EVICT_MS) {
    lastSweep = now;
    for (const [k, b] of buckets) if (now - b.updatedAt > IDLE_EVICT_MS) buckets.delete(k);
  }

  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now };
  const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_SECOND);
  bucket.updatedAt = now;
  buckets.set(key, bucket);

  if (bucket.tokens < 1) {
    return { ok: false, retryAfterSeconds: Math.ceil((1 - bucket.tokens) / REFILL_PER_SECOND) };
  }
  bucket.tokens -= 1;
  return { ok: true };
}

/** Test helper: forget every bucket. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
