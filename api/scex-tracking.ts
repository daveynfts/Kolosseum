/**
 * SCEX partner tracking (matrix + livefeed).
 *
 * GET  /api/scex-tracking — public read
 * PUT  /api/scex-tracking — Bearer FEED_ADMIN_TOKEN
 *
 * R2 key: scex/tracking/v1.json
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  envPresence,
  SCEX_TRACKING_OBJECT_KEY,
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

type Body = {
  version?: number
  kind?: string
  asOf?: string
  config?: unknown
  actors?: unknown[]
  posts?: unknown[]
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

function isValidBody(body: Body): boolean {
  return !!body && typeof body === 'object' && body.config != null
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
      if (!enforcePublicRateLimit(req, res, 'scex-tracking', 90)) return
      const data = await r2GetJson<Body>(client, SCEX_TRACKING_OBJECT_KEY)
      if (!data || !data.config) {
        return res.status(404).json({
          error: 'empty',
          message: 'No SCEX tracking data on server yet. Admin → SCEX → Save.',
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
          message: 'Need config object (actors/posts optional arrays)',
        })
      }
      const current = await r2GetJson<Body>(client, SCEX_TRACKING_OBJECT_KEY)
      const stale = assertNotStale(
        current?.updatedAt,
        readBaseUpdatedAt(body as Record<string, unknown>),
      )
      if (!stale.ok) {
        return res.status(409).json({
          error: 'conflict',
          message: 'Server có SCEX mới hơn. Reload rồi Save lại.',
          serverUpdatedAt: stale.serverUpdatedAt,
        })
      }
      const payload: Body = {
        ...body,
        version: body.version ?? 1,
        kind: body.kind || 'scex-tracking',
        updatedAt: new Date().toISOString(),
        actors: Array.isArray(body.actors) ? body.actors : [],
        posts: Array.isArray(body.posts) ? body.posts : [],
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      await r2PutJson(client, SCEX_TRACKING_OBJECT_KEY, payload)
      return res.status(200).json({
        ok: true,
        actors: Array.isArray(payload.actors) ? payload.actors.length : 0,
        posts: Array.isArray(payload.posts) ? payload.posts.length : 0,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key: SCEX_TRACKING_OBJECT_KEY,
      })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/scex-tracking]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : 'unknown',
    })
  }
}
