import type { VercelRequest, VercelResponse } from '@vercel/node'
import { env } from './r2.js'
import { checkRateLimit, pruneRateLimitBuckets } from './rateLimit.js'

export function bearer(req: VercelRequest): string {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ') || h.startsWith('bearer ')) return h.slice(7).trim()
  return ''
}

export function isAdmin(req: VercelRequest): boolean {
  const secret = env('FEED_ADMIN_TOKEN')
  if (!secret) return false
  return bearer(req) === secret
}

/** Debug/env probes: admin token only. */
export function debugAllowed(req: VercelRequest): boolean {
  return isAdmin(req)
}

export type StaleCheck =
  | { ok: true }
  | { ok: false; serverUpdatedAt: string }

export function assertNotStale(
  serverUpdatedAt: string | undefined | null,
  clientBaseUpdatedAt: string | undefined | null,
): StaleCheck {
  if (!serverUpdatedAt || !clientBaseUpdatedAt) return { ok: true }
  const serverT = Date.parse(serverUpdatedAt)
  const clientT = Date.parse(clientBaseUpdatedAt)
  if (!Number.isFinite(serverT) || !Number.isFinite(clientT)) return { ok: true }
  if (serverT > clientT) return { ok: false, serverUpdatedAt }
  return { ok: true }
}

export function readBaseUpdatedAt(body: Record<string, unknown>): string | undefined {
  const v = body.baseUpdatedAt ?? body.clientUpdatedAt
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim()
  }
  if (Array.isArray(fwd) && fwd[0]) return String(fwd[0]).trim()
  const real = req.headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  return 'unknown'
}

export function cors(
  res: VercelResponse,
  methods: string,
  headers = 'Content-Type, Authorization',
): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', headers)
}

export function jsonError(
  res: VercelResponse,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): VercelResponse {
  return res.status(status).json({ error, ...extra })
}

/** Public read verbs (health checks / curl -I use HEAD). */
export function isGetOrHead(method?: string | null): boolean {
  return method === 'GET' || method === 'HEAD'
}

/**
 * JSON response for GET; HEAD returns the same status with empty body
 * (so monitoring tools get 200 instead of 405).
 */
export function sendJson(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  body: unknown,
): VercelResponse {
  if (req.method === 'HEAD') {
    return res.status(status).end()
  }
  return res.status(status).json(body)
}

export function conflictResponse(
  res: VercelResponse,
  message: string,
  serverUpdatedAt: string,
): VercelResponse {
  return res.status(409).json({
    error: 'conflict',
    message,
    serverUpdatedAt,
  })
}

/**
 * Public GET rate limit. Skipped for admin Bearer on same request.
 * @returns true if request should proceed
 */
export function enforcePublicRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  routeKey: string,
  maxPerMinute = 90,
): boolean {
  if (isAdmin(req)) return true
  pruneRateLimitBuckets()
  const key = `${routeKey}:${clientIp(req)}`
  const hit = checkRateLimit(key, maxPerMinute, 60_000)
  if (hit.ok === true) return true
  res.setHeader('Retry-After', String(hit.retryAfterSec))
  jsonError(res, 429, 'rate_limit_exceeded', {
    message: 'Too many requests — try again shortly.',
    retryAfterSec: hit.retryAfterSec,
  })
  return false
}
