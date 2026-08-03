/**
 * Conviction 2026 side events (map + admin).
 *
 * GET  /api/event-side-events — public read
 * PUT  /api/event-side-events — Bearer FEED_ADMIN_TOKEN
 *
 * R2 key: events/conviction-2026/v1.json
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  envPresence,
  EVENT_SIDE_EVENTS_OBJECT_KEY,
  r2Client,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'
import {
  assertNotStale,
  bearer,
  enforcePublicRateLimit,
  readBaseUpdatedAt,
} from '../lib/server/apiHelpers.js'
import { cacheEventImageUrls } from '../lib/server/mediaCache.js'

type SideEventBody = {
  id?: string
  title?: string
  lat?: number
  lng?: number
  date?: string
  [k: string]: unknown
}

type Body = {
  version?: number
  kind?: string
  event?: string
  title?: string
  venue?: unknown
  dateRange?: unknown
  events?: SideEventBody[]
  updatedAt?: string
  note?: string
  [k: string]: unknown
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function isValidEvent(e: SideEventBody): boolean {
  if (!e || typeof e !== 'object') return false
  if (typeof e.id !== 'string' || !e.id.trim()) return false
  if (typeof e.title !== 'string' || !e.title.trim()) return false
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
    return false
  }
  const lat = Number(e.lat)
  const lng = Number(e.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  return true
}

function isValidBody(body: Body): boolean {
  if (!body || typeof body !== 'object') return false
  if (body.event != null && body.event !== 'conviction-2026') return false
  if (!Array.isArray(body.events)) return false
  return body.events.every(isValidEvent)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const client = r2Client()
  if (!client) {
    return res.status(503).json({
      error: 'r2_not_configured',
      message: 'Cloudflare R2 not configured.',
      env: envPresence(),
    })
  }

  try {
    if (req.method === 'GET') {
      if (!enforcePublicRateLimit(req, res, 'event-side-events', 90)) return
      const data = await r2GetJson<Body>(client, EVENT_SIDE_EVENTS_OBJECT_KEY)
      if (!data || !Array.isArray(data.events)) {
        return res.status(404).json({
          error: 'empty',
          message:
            'No side-event data yet. Admin → Events → Save to publish.',
        })
      }
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const secret = env('FEED_ADMIN_TOKEN')
      if (!secret) {
        return res.status(503).json({
          error: 'token_not_configured',
          message: 'Set FEED_ADMIN_TOKEN + Redeploy.',
        })
      }
      const got = bearer(req)
      if (!got || got !== secret) {
        return res.status(401).json({ error: 'unauthorized' })
      }
      const body = (
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      ) as Body
      if (!isValidBody(body)) {
        return res.status(400).json({
          error: 'invalid_body',
          message:
            'Need events[] with id, title, date (YYYY-MM-DD), lat, lng per item',
        })
      }
      const current = await r2GetJson<Body>(
        client,
        EVENT_SIDE_EVENTS_OBJECT_KEY,
      )
      const stale = assertNotStale(
        current?.updatedAt,
        readBaseUpdatedAt(body as Record<string, unknown>),
      )
      if (stale.ok === false) {
        return res.status(409).json({
          error: 'conflict',
          message: 'Server có dữ liệu Events mới hơn. Reload rồi Save lại.',
          serverUpdatedAt: stale.serverUpdatedAt,
        })
      }
      // Best-effort: pull Luma covers onto R2 so map pins load from CDN
      const imagePass = await cacheEventImageUrls(
        client,
        (body.events || []) as Array<SideEventBody & { imageUrl?: string }>,
        { deadlineMs: 8_000 },
      )
      const payload: Body = {
        ...body,
        version: 1,
        kind: 'conviction-side-events',
        event: 'conviction-2026',
        events: imagePass.events,
        updatedAt: new Date().toISOString(),
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      await r2PutJson(client, EVENT_SIDE_EVENTS_OBJECT_KEY, payload)
      return res.status(200).json({
        ok: true,
        events: Array.isArray(payload.events) ? payload.events.length : 0,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key: EVENT_SIDE_EVENTS_OBJECT_KEY,
        imagesCached: imagePass.cached,
        imagesFailed: imagePass.failed,
      })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/event-side-events]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : 'unknown',
    })
  }
}
