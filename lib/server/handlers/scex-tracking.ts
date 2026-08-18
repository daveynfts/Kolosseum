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
  envPresence,
  SCEX_TRACKING_OBJECT_KEY,
  r2Client,
  r2GetJson,
} from '../r2.js'
import {
  commitJsonReplace,
  askedAdminSlice,
  enforcePublicRateLimit,
  isAdmin,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
  serveAdminSlice,
} from '../apiHelpers.js'
import { publicScexDataset } from '../scexPublic.js'

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function isValidBody(body: Body): boolean {
  return (
    !!body &&
    typeof body === 'object' &&
    body.config != null &&
    Array.isArray(body.actors) &&
    Array.isArray(body.posts)
  )
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
      if (!enforcePublicRateLimit(req, res, 'scex-tracking', 90)) return
      const data = await r2GetJson<Body>(client, SCEX_TRACKING_OBJECT_KEY)
      if (!data || !data.config) {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No SCEX tracking data on server yet. Admin → SCEX → Save.',
        })
      }
      const wantAll = serveAdminSlice(req)
      if (askedAdminSlice(req) && !isAdmin(req)) {
        return sendJson(req, res, 401, {
          error: 'unauthorized',
          message: 'Admin token required for full SCEX dataset',
        })
      }
      if (wantAll) return sendJson(req, res, 200, data)
      return sendJson(req, res, 200, publicScexDataset(data))
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const parsed = parseJsonBody<Body>(req)
      if (parsed.ok === false) {
        return jsonError(res, 400, parsed.error, {
          message: 'Need config object plus actors[] and posts[] arrays',
        })
      }
      const body = parsed.body
      if (!isValidBody(body)) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Need config object plus actors[] and posts[] arrays',
        })
      }
      if (
        (body.actors as unknown[]).length === 0 &&
        (body.posts as unknown[]).length === 0
      ) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'actors[] and posts[] cannot both be empty',
        })
      }
      const payload: Body = {
        ...body,
        version: body.version ?? 1,
        kind: body.kind || 'scex-tracking',
        updatedAt: new Date().toISOString(),
        actors: body.actors,
        posts: body.posts,
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      if (
        !(await commitJsonReplace(
          res,
          client,
          SCEX_TRACKING_OBJECT_KEY,
          body as Record<string, unknown>,
          (current) => current?.updatedAt,
          'Server có SCEX mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
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
