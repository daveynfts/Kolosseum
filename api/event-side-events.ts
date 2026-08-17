/**
 * Event-map side events (one R2 object per edition slug).
 *
 * GET  /api/event-side-events?event=conviction-2026 — public read
 * GET  /api/event-side-events?list=1               — edition catalog
 * PUT  /api/event-side-events?event=<slug>         — Bearer FEED_ADMIN_TOKEN
 *
 * R2: events/<slug>/v1.json + events/index.json
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  envPresence,
  EVENT_EDITIONS_INDEX_KEY,
  EVENT_SIDE_EVENTS_OBJECT_KEY,
  r2Client,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'
import { repairJsonStrings } from '../src/lib/lumaText.js'
import {
  commitJsonReplace,
  enforcePublicRateLimit,
  isAdmin,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
} from '../lib/server/apiHelpers.js'
import { cacheEventImageUrls } from '../lib/server/mediaCache.js'
import {
  DEFAULT_EVENT_SLUG,
  eventObjectKey,
  mergeEditionCatalog,
  parseEventSlug,
  seedEditionBySlug,
  titleFromSlug,
  upsertEditionInCatalog,
  yearFromSlug,
  type EventEditionMeta,
  type EventEditionStatus,
} from '../src/data/eventEditions.js'

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
  archived?: boolean
  [k: string]: unknown
}

type IndexBody = {
  version?: number
  kind?: string
  editions?: EventEditionMeta[]
  updatedAt?: string
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function querySlug(req: VercelRequest): string | null {
  const raw = req.query.event
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v == null || v === '') return DEFAULT_EVENT_SLUG
  return parseEventSlug(String(v))
}

function objectKeyForSlug(slug: string): string {
  if (slug === DEFAULT_EVENT_SLUG) return EVENT_SIDE_EVENTS_OBJECT_KEY
  return eventObjectKey(slug)
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

function isValidBody(body: Body, slug: string): boolean {
  if (!body || typeof body !== 'object') return false
  if (body.event != null && parseEventSlug(body.event) !== slug) return false
  if (!Array.isArray(body.events)) return false
  return body.events.every(isValidEvent)
}

function editionMetaFromDataset(
  slug: string,
  body: Body,
): EventEditionMeta {
  const seed = seedEditionBySlug(slug)
  const range =
    body.dateRange && typeof body.dateRange === 'object'
      ? (body.dateRange as { start?: string; end?: string })
      : null
  const start = typeof range?.start === 'string' ? range.start : ''
  const end = typeof range?.end === 'string' ? range.end : ''
  const dateLabel =
    start && end
      ? `${start.slice(8, 10)}/${start.slice(5, 7)}–${end.slice(8, 10)}/${end.slice(5, 7)}/${end.slice(0, 4)}`
      : seed?.dateLabel
  const archived = body.archived === true
  const status: EventEditionStatus = archived
    ? 'archive'
    : seed?.status === 'archive'
      ? 'live'
      : seed?.status || 'live'
  const venue =
    body.venue && typeof body.venue === 'object'
      ? (body.venue as { name?: string })
      : null
  return {
    slug,
    title:
      (typeof body.title === 'string' && body.title.trim()) ||
      seed?.title ||
      titleFromSlug(slug),
    year: yearFromSlug(slug) || seed?.year || new Date().getUTCFullYear(),
    status,
    lumaUrl: seed?.lumaUrl,
    homeUrl: seed?.homeUrl,
    logoUrl: seed?.logoUrl,
    ogImage: seed?.ogImage,
    venueName:
      (typeof venue?.name === 'string' && venue.name.trim()) ||
      seed?.venueName,
    city: seed?.city,
    dateLabel,
    descriptionVi: seed?.descriptionVi,
    descriptionEn: seed?.descriptionEn,
  }
}

async function upsertIndex(
  client: NonNullable<ReturnType<typeof r2Client>>,
  edition: EventEditionMeta,
) {
  const current = await r2GetJson<IndexBody>(client, EVENT_EDITIONS_INDEX_KEY)
  const merged = mergeEditionCatalog(current)
  const editions = upsertEditionInCatalog(merged, edition)
  const payload: IndexBody = {
    version: 1,
    kind: 'event-editions',
    editions,
    updatedAt: new Date().toISOString(),
  }
  await r2PutJson(client, EVENT_EDITIONS_INDEX_KEY, payload)
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
    if (isGetOrHead(req.method)) {
      if (!enforcePublicRateLimit(req, res, 'event-side-events', 90)) return

      const list =
        String(req.query.list || '') === '1' ||
        String(req.query.scope || '') === 'editions'
      if (list) {
        const index = await r2GetJson<IndexBody>(
          client,
          EVENT_EDITIONS_INDEX_KEY,
        )
        const editions = mergeEditionCatalog(index)
        return sendJson(req, res, 200, {
          version: 1,
          kind: 'event-editions',
          editions,
          updatedAt: index?.updatedAt || new Date().toISOString(),
        })
      }

      const slug = querySlug(req)
      if (!slug) {
        return jsonError(res, 400, 'invalid_event', {
          message: 'event slug must match [a-z0-9][a-z0-9-]{0,62}[a-z0-9]',
        })
      }
      const key = objectKeyForSlug(slug)
      const data = await r2GetJson<Body>(client, key)
      if (!data || !Array.isArray(data.events)) {
        return sendJson(req, res, 404, {
          error: 'empty',
          event: slug,
          message:
            'No side-event data yet. Admin → Events → Save to publish.',
        })
      }
      const wantAll =
        String(req.query.all || '') === '1' ||
        String(req.query.scope || '') === 'admin'
      if (wantAll && !isAdmin(req)) {
        return sendJson(req, res, 401, {
          error: 'unauthorized',
          message: 'Admin token required for full events dataset',
        })
      }
      const repaired = repairJsonStrings({ ...data, event: slug })
      if (wantAll) return sendJson(req, res, 200, repaired)
      const events = (repaired.events || []).filter(
        (e: SideEventBody) => e && e.hidden !== true,
      )
      return sendJson(req, res, 200, { ...repaired, events })
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const slug = querySlug(req)
      if (!slug) {
        return jsonError(res, 400, 'invalid_event', {
          message: 'event slug must match [a-z0-9][a-z0-9-]{0,62}[a-z0-9]',
        })
      }
      const parsed = parseJsonBody<Body>(req)
      if (parsed.ok === false) {
        return jsonError(res, 400, parsed.error, {
          message:
            'Need events[] with id, title, date (YYYY-MM-DD), lat, lng per item',
        })
      }
      const body = parsed.body
      if (!isValidBody(body, slug)) {
        return jsonError(res, 400, 'invalid_body', {
          message:
            'Need events[] with id, title, date (YYYY-MM-DD), lat, lng per item',
        })
      }
      const imagePass = await cacheEventImageUrls(
        client,
        (body.events || []) as Array<SideEventBody & { imageUrl?: string }>,
        { deadlineMs: 8_000 },
      )
      const payload: Body = repairJsonStrings({
        ...body,
        version: 1,
        kind:
          slug === DEFAULT_EVENT_SLUG
            ? 'conviction-side-events'
            : 'side-events',
        event: slug,
        events: imagePass.events,
        updatedAt: new Date().toISOString(),
      })
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      const key = objectKeyForSlug(slug)
      if (
        !(await commitJsonReplace(
          res,
          client,
          key,
          body as Record<string, unknown>,
          (current) => current?.updatedAt,
          'Server có dữ liệu Events mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
      try {
        await upsertIndex(client, editionMetaFromDataset(slug, payload))
      } catch (e) {
        console.error('[api/event-side-events] index upsert', e)
      }
      return res.status(200).json({
        ok: true,
        event: slug,
        events: Array.isArray(payload.events) ? payload.events.length : 0,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key,
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
