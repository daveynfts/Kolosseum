/**
 * Smart / Recent Followers JSON on Cloudflare R2.
 *
 * GET  /api/recent-followers — public read
 * PUT  /api/recent-followers — Bearer FEED_ADMIN_TOKEN
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  envPresence,
  RECENT_FOLLOWERS_OBJECT_KEY,
  r2Client,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'
import {
  assertNotStale,
  bearer,
  debugAllowed,
  enforcePublicRateLimit,
  readBaseUpdatedAt,
} from '../lib/server/apiHelpers.js'

type Body = {
  version?: number
  updatedAt?: string
  baseUpdatedAt?: string
  source?: string
  note?: string
  count?: number
  map?: Record<string, unknown>
  smartMap?: Record<string, unknown>
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET' && (req.query.debug === '1' || req.query.debug === 'true')) {
    if (!debugAllowed(req)) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    return res.status(200).json({
      ok: true,
      storage: 'cloudflare-r2',
      key: RECENT_FOLLOWERS_OBJECT_KEY,
      r2Ready: !!r2Client(),
    })
  }

  const client = r2Client()
  if (!client) {
    return res.status(503).json({
      error: 'r2_not_configured',
      message: 'Cloudflare R2 not configured.',
      env: debugAllowed(req) ? envPresence() : undefined,
    })
  }

  try {
    if (req.method === 'GET') {
      if (!enforcePublicRateLimit(req, res, 'recent-followers', 90)) return
      const data = await r2GetJson<Body>(client, RECENT_FOLLOWERS_OBJECT_KEY)
      if (!data?.map || typeof data.map !== 'object') {
        return res.status(404).json({
          error: 'empty',
          message: 'No recent-followers map on server yet.',
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
      const body = (typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body) as Body
      if (!body?.map || typeof body.map !== 'object') {
        return res.status(400).json({ error: 'invalid_body', message: 'Need map{}' })
      }

      const current = await r2GetJson<Body>(client, RECENT_FOLLOWERS_OBJECT_KEY)
      const stale = assertNotStale(
        current?.updatedAt,
        readBaseUpdatedAt(body as Record<string, unknown>),
      )
      if (!stale.ok) {
        return res.status(409).json({
          error: 'conflict',
          message:
            'Server có bản followers mới hơn. Reload admin rồi Save lại.',
          serverUpdatedAt: stale.serverUpdatedAt,
        })
      }

      const payload: Body = {
        version: body.version ?? 1,
        updatedAt: new Date().toISOString(),
        source: body.source || 'admin server',
        note: body.note,
        count: Object.keys(body.map).length,
        map: body.map,
        smartMap:
          body.smartMap && typeof body.smartMap === 'object'
            ? body.smartMap
            : current?.smartMap,
      }
      await r2PutJson(client, RECENT_FOLLOWERS_OBJECT_KEY, payload)
      return res.status(200).json({
        ok: true,
        count: payload.count,
        smartCount: payload.smartMap
          ? Object.keys(payload.smartMap).length
          : 0,
        updatedAt: payload.updatedAt,
        storage: 'r2',
      })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/recent-followers]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : 'unknown',
    })
  }
}
