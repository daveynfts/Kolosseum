/**
 * Partner event ribbon config (text + image URLs on R2).
 *
 * GET  /api/site-banner — public read
 * PUT  /api/site-banner — Bearer FEED_ADMIN_TOKEN
 *
 * R2 key: site/banner/v1.json
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  envPresence,
  SITE_BANNER_OBJECT_KEY,
  r2Client,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'
import {
  assertNotStale,
  bearer,
  conflictResponse,
  cors,
  enforcePublicRateLimit,
  jsonError,
  readBaseUpdatedAt,
} from '../lib/server/apiHelpers.js'

type Body = {
  version?: number
  kind?: string
  enabled?: boolean
  href?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  pill?: string
  cta?: string
  ariaLabel?: string
  logoUrl?: string
  artUrl?: string
  updatedAt?: string
  note?: string
  [k: string]: unknown
}

function isValidBody(body: Body): boolean {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof body.href === 'string' &&
    typeof body.title === 'string'
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, 'GET, PUT, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const client = r2Client()
  if (!client) {
    return jsonError(res, 503, 'r2_not_configured', {
      message: 'Cloudflare R2 not configured.',
      env: envPresence(),
    })
  }

  try {
    if (req.method === 'GET') {
      if (!enforcePublicRateLimit(req, res, 'site-banner', 90)) return
      const data = await r2GetJson<Body>(client, SITE_BANNER_OBJECT_KEY)
      if (!data || typeof data.href !== 'string') {
        return jsonError(res, 404, 'empty', {
          message: 'No banner config on server yet. Admin → Banner → Save.',
        })
      }
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const secret = env('FEED_ADMIN_TOKEN')
      if (!secret) {
        return jsonError(res, 503, 'token_not_configured', {
          message: 'Set FEED_ADMIN_TOKEN + Redeploy.',
        })
      }
      const got = bearer(req)
      if (!got || got !== secret) {
        return jsonError(res, 401, 'unauthorized')
      }
      const body = (
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      ) as Body
      if (!isValidBody(body)) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Need href and title at minimum',
        })
      }
      const current = await r2GetJson<Body>(client, SITE_BANNER_OBJECT_KEY)
      const stale = assertNotStale(
        current?.updatedAt,
        readBaseUpdatedAt(body as Record<string, unknown>),
      )
      if (stale.ok === false) {
        return conflictResponse(
          res,
          'Server có banner mới hơn. Reload rồi Save lại.',
          stale.serverUpdatedAt,
        )
      }
      const payload: Body = {
        ...body,
        version: body.version ?? 1,
        kind: 'site-banner',
        enabled: body.enabled !== false,
        updatedAt: new Date().toISOString(),
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      await r2PutJson(client, SITE_BANNER_OBJECT_KEY, payload)
      return res.status(200).json({
        ok: true,
        enabled: payload.enabled,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key: SITE_BANNER_OBJECT_KEY,
      })
    }

    return jsonError(res, 405, 'method_not_allowed')
  } catch (e) {
    console.error('[api/site-banner]', e)
    return jsonError(res, 500, 'server_error', {
      message: e instanceof Error ? e.message : 'unknown',
    })
  }
}
