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
  env,
  envPresence,
  FEED_OBJECT_KEY,
  r2Client,
  r2Configured,
  r2Delete,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function bearer(req: VercelRequest): string {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ') || h.startsWith('bearer ')) return h.slice(7).trim()
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET' && (req.query.debug === '1' || req.query.debug === 'true')) {
    return res.status(200).json({
      ok: true,
      storage: 'cloudflare-r2',
      r2Ready: r2Configured(),
      env: envPresence(),
      hint: r2Configured()
        ? 'R2 creds visible to function.'
        : 'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME + Redeploy.',
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
    if (req.method === 'GET') {
      const data = await r2GetJson<FeedBody>(client, FEED_OBJECT_KEY)
      if (!data || !Array.isArray(data.posts)) {
        return res.status(404).json({
          error: 'empty',
          message: 'No feed on server yet. Save from Admin → Feed.',
        })
      }
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const secret = env('FEED_ADMIN_TOKEN')
      if (!secret) {
        return res.status(503).json({
          error: 'token_not_configured',
          message: 'Set FEED_ADMIN_TOKEN in Vercel env + Redeploy.',
          env: envPresence(),
        })
      }
      const got = bearer(req)
      if (!got || got !== secret) {
        return res.status(401).json({
          error: 'unauthorized',
          message:
            'Token mismatch. Use FEED_ADMIN_TOKEN (not R2/Upstash keys).',
          hint: {
            receivedLen: got.length,
            expectedLen: secret.length,
          },
        })
      }

      const body = (
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      ) as FeedBody

      if (!body || !Array.isArray(body.posts)) {
        return res.status(400).json({
          error: 'invalid_body',
          message: 'Body must be feed JSON with posts[]',
        })
      }

      const payload: FeedBody = {
        ...body,
        mode: 'admin',
        source: body.source || 'admin server r2',
        generatedAt: new Date().toISOString(),
        postCount: body.posts.length,
      }

      await r2PutJson(client, FEED_OBJECT_KEY, payload)
      return res.status(200).json({
        ok: true,
        postCount: body.posts.length,
        generatedAt: payload.generatedAt,
        storage: 'r2',
      })
    }

    if (req.method === 'DELETE') {
      const secret = env('FEED_ADMIN_TOKEN')
      if (!secret || bearer(req) !== secret) {
        return res.status(401).json({ error: 'unauthorized' })
      }
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
