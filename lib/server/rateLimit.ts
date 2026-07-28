/**
 * Best-effort in-memory rate limit (per serverless instance).
 * Sufficient to dampen casual abuse; not a global quota across all Vercel regions.
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number }

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const k = key.trim() || 'unknown'
  const bucket = buckets.get(k)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(k, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (bucket.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }
  bucket.count += 1
  return { ok: true }
}

/** Trim stale buckets occasionally (avoid unbounded Map growth). */
export function pruneRateLimitBuckets(now = Date.now()): void {
  if (buckets.size < 500) return
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k)
  }
}
