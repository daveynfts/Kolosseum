/**
 * Shared Tier-1 feed JSON on Cloudflare R2.
 *
 * Env:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   FEED_ADMIN_TOKEN (PUT/DELETE)
 * Optional:
 *   R2_PUBLIC_BASE_URL — public CDN for media (not required for feed JSON)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  envPresence,
  FEED_OBJECT_KEY,
  r2Client,
  r2Configured,
  r2Delete,
  r2GetJson,
} from '../r2.js'
import {
  commitJsonReplace,
  debugAllowed,
  enforcePublicRateLimit,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
} from '../apiHelpers.js'

type FeedBody = {
  posts?: unknown[]
  generatedAt?: string
  source?: string
  mode?: string
  postCount?: number
  [k: string]: unknown
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, DELETE, OPTIONS')
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
      r2Ready: r2Configured(),
      env: envPresence(),
    })
  }

  const client = r2Client()
  if (!client) {
    return res.status(503).json({
      error: 'r2_not_configured',
      message:
        'Cloudflare R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME. Debug: /api/feed?debug=1',
      env: envPresence(),
    })
  }

  try {
    if (isGetOrHead(req.method)) {
      if (!enforcePublicRateLimit(req, res, 'feed', 90)) return
      const data = await r2GetJson<FeedBody>(client, FEED_OBJECT_KEY)
      if (!data || !Array.isArray(data.posts)) {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No feed on server yet. Save from Admin → Feed.',
        })
      }
      return sendJson(req, res, 200, data)
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const parsed = parseJsonBody<FeedBody & { baseUpdatedAt?: string }>(req)
      if (parsed.ok === false) {
        return jsonError(res, 400, parsed.error, {
          message: 'Body must be feed JSON with posts[]',
        })
      }
      const body = parsed.body
      if (!body || !Array.isArray(body.posts) || body.posts.length === 0) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Body must be feed JSON with non-empty posts[]',
        })
      }

      const payload: FeedBody = {
        ...body,
        mode: 'admin',
        source: body.source || 'admin server r2',
        generatedAt: new Date().toISOString(),
        postCount: body.posts.length,
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt

      if (
        !(await commitJsonReplace(
          res,
          client,
          FEED_OBJECT_KEY,
          body as Record<string, unknown>,
          (current) => current?.generatedAt,
          'Server có feed mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
      return res.status(200).json({
        ok: true,
        postCount: body.posts.length,
        generatedAt: payload.generatedAt,
        storage: 'r2',
      })
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return
      await r2Delete(client, FEED_OBJECT_KEY)
      return res.status(200).json({ ok: true, cleared: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/feed]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
