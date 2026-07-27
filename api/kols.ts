/**
 * Shared KOL list JSON on Cloudflare R2 (same token as feed).
 *
 * GET  /api/kols — public read
 * PUT  /api/kols — Bearer FEED_ADMIN_TOKEN
 * DELETE /api/kols — clear server copy
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  envPresence,
  KOLS_OBJECT_KEY,
  r2Client,
  r2Configured,
  r2Delete,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'
import {
  assertNotStale,
  bearer,
  debugAllowed,
  readBaseUpdatedAt,
} from '../lib/server/apiHelpers.js'

type KolsBody = {
  version?: number
  updatedAt?: string
  source?: string
  note?: string
  count?: number
  kols?: unknown[]
  /** Global Surf mock PDF (R2 public URL) */
  surfDefaultPdfUrl?: string
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
      key: KOLS_OBJECT_KEY,
      r2Ready: r2Configured(),
      env: envPresence(),
    })
  }

  const client = r2Client()
  if (!client) {
    return res.status(503).json({
      error: 'r2_not_configured',
      message:
        'Cloudflare R2 not configured. Set R2_* env + Redeploy. Debug: /api/kols?debug=1',
      env: envPresence(),
    })
  }

  try {
    if (req.method === 'GET') {
      const data = await r2GetJson<KolsBody>(client, KOLS_OBJECT_KEY)
      if (!data || !Array.isArray(data.kols) || data.kols.length === 0) {
        return res.status(404).json({
          error: 'empty',
          message: 'No KOL list on server yet. Save from Admin → Save to server.',
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
          message: 'Token mismatch. Use FEED_ADMIN_TOKEN.',
        })
      }

      const body = (
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      ) as KolsBody

      if (!body || !Array.isArray(body.kols) || body.kols.length === 0) {
        return res.status(400).json({
          error: 'invalid_body',
          message: 'Body must be JSON with non-empty kols[]',
        })
      }

      const current = await r2GetJson<KolsBody>(client, KOLS_OBJECT_KEY)
      const stale = assertNotStale(
        current?.updatedAt,
        readBaseUpdatedAt(body as Record<string, unknown>),
      )
      if (!stale.ok) {
        return res.status(409).json({
          error: 'conflict',
          message: 'Server có KOL list mới hơn. Reload rồi Save lại.',
          serverUpdatedAt: stale.serverUpdatedAt,
        })
      }

      const payload: KolsBody = {
        version: body.version ?? 3,
        updatedAt: new Date().toISOString(),
        source: body.source || 'admin server r2',
        note: body.note,
        count: body.kols.length,
        kols: body.kols,
        surfDefaultPdfUrl:
          typeof body.surfDefaultPdfUrl === 'string'
            ? body.surfDefaultPdfUrl.trim() || undefined
            : undefined,
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt

      await r2PutJson(client, KOLS_OBJECT_KEY, payload)
      return res.status(200).json({
        ok: true,
        count: body.kols.length,
        updatedAt: payload.updatedAt,
        storage: 'r2',
      })
    }

    if (req.method === 'DELETE') {
      const secret = env('FEED_ADMIN_TOKEN')
      if (!secret || bearer(req) !== secret) {
        return res.status(401).json({ error: 'unauthorized' })
      }
      await r2Delete(client, KOLS_OBJECT_KEY)
      return res.status(200).json({ ok: true, cleared: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/kols]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
