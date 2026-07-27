import type { VercelRequest } from '@vercel/node'
import { env } from './r2.js'

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

/** Debug/env probes: admin token only (not public in production). */
export function debugAllowed(req: VercelRequest): boolean {
  return isAdmin(req)
}

export type StaleCheck =
  | { ok: true }
  | { ok: false; serverUpdatedAt: string }

/**
 * Reject PUT when server copy is newer than client's base timestamp.
 * Skip check when either side is missing (first write / legacy clients).
 */
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
