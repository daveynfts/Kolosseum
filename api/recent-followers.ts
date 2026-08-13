/**
 * Smart / Recent Followers JSON on Cloudflare R2.
 *
 * GET  /api/recent-followers — public read
 * PUT  /api/recent-followers — Bearer FEED_ADMIN_TOKEN
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  envPresence,
  RECENT_FOLLOWERS_OBJECT_KEY,
  r2Client,
  r2GetJson,
} from '../lib/server/r2.js'
import {
  commitJsonReplace,
  debugAllowed,
  enforcePublicRateLimit,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (
    isGetOrHead(req.method) &&
    (req.query.debug === '1' || req.query.debug === 'true')
  ) {
    if (!debugAllowed(req)) {
      return sendJson(req, res, 401, { error: 'unauthorized' })
    }
    return sendJson(req, res, 200, {
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
    if (isGetOrHead(req.method)) {
      if (!enforcePublicRateLimit(req, res, 'recent-followers', 90)) return
      const data = await r2GetJson<Body>(client, RECENT_FOLLOWERS_OBJECT_KEY)
      if (!data?.map || typeof data.map !== 'object') {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No recent-followers map on server yet.',
        })
      }
      return sendJson(req, res, 200, data)
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const parsed = parseJsonBody<Body>(req)
      if (parsed.ok === false) {
        return jsonError(res, 400, parsed.error, { message: 'Need map{}' })
      }
      const body = parsed.body
      if (!body?.map || typeof body.map !== 'object') {
        return jsonError(res, 400, 'invalid_body', { message: 'Need map{}' })
      }

      const current = await r2GetJson<Body>(client, RECENT_FOLLOWERS_OBJECT_KEY)
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
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      if (
        !(await commitJsonReplace(
          res,
          client,
          RECENT_FOLLOWERS_OBJECT_KEY,
          body as Record<string, unknown>,
          (cur) => cur?.updatedAt,
          'Server có bản followers mới hơn. Reload admin rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
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
