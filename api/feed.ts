/**
 * Vercel Serverless: GET/PUT shared Tier-1 feed JSON.
 *
 * Env (any pair works):
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL + KV_REST_API_TOKEN
 *   FEED_ADMIN_TOKEN  (required for PUT/DELETE)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { env, envPresence, pickRedisCreds, redisClient } from '../lib/server/redis'

const FEED_KEY = 'vn-kol-map:feed:v1'

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
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'GET' && (req.query.debug === '1' || req.query.debug === 'true')) {
    const { url, token } = pickRedisCreds()
    return res.status(200).json({
      ok: true,
      redisReady: !!(url && token),
      urlHost: url
        ? (() => {
            try {
              return new URL(url).host
            } catch {
              return 'invalid_url'
            }
          })()
        : null,
      env: envPresence(),
      hint: !url || !token
        ? 'URL or TOKEN empty in this deployment. Check Production env + Redeploy.'
        : 'Creds visible to function.',
    })
  }

  const redis = redisClient()
  if (!redis) {
    return res.status(503).json({
      error: 'redis_not_configured',
      message:
        'Server cannot see Redis REST URL+TOKEN. Debug: /api/feed?debug=1',
      env: envPresence(),
    })
  }

  try {
    if (req.method === 'GET') {
      const data = await redis.get<FeedBody>(FEED_KEY)
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
          message: 'Set FEED_ADMIN_TOKEN in Vercel env (Production) + Redeploy.',
          env: envPresence(),
        })
      }
      const got = bearer(req)
      if (!got || got !== secret) {
        return res.status(401).json({
          error: 'unauthorized',
          message:
            'Token mismatch. Use FEED_ADMIN_TOKEN from Vercel env (not Redis token).',
          hint: {
            receivedLen: got.length,
            expectedLen: secret.length,
            hasBearer: !!(req.headers.authorization || '')
              .toLowerCase()
              .startsWith('bearer '),
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
        source: body.source || 'admin server',
        generatedAt: new Date().toISOString(),
        postCount: body.posts.length,
      }

      await redis.set(FEED_KEY, payload)
      return res.status(200).json({
        ok: true,
        postCount: body.posts.length,
        generatedAt: payload.generatedAt,
      })
    }

    if (req.method === 'DELETE') {
      const secret = env('FEED_ADMIN_TOKEN')
      if (!secret || bearer(req) !== secret) {
        return res.status(401).json({ error: 'unauthorized' })
      }
      await redis.del(FEED_KEY)
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
