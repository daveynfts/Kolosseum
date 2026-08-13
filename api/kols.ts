/**
 * Shared KOL list JSON on Cloudflare R2 (same token as feed).
 *
 * GET  /api/kols          — public: hidden KOLs stripped
 * GET  /api/kols?all=1    — full list (Bearer FEED_ADMIN_TOKEN)
 * PUT  /api/kols          — Bearer FEED_ADMIN_TOKEN
 * DELETE /api/kols        — clear server copy
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  envPresence,
  KOLS_OBJECT_KEY,
  r2Client,
  r2Configured,
  r2Delete,
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
  isAdmin,
  sendJson,
} from '../lib/server/apiHelpers.js'
import { publicKolsOnly } from '../lib/server/kolsPublic.js'

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
    if (isGetOrHead(req.method)) {
      if (!enforcePublicRateLimit(req, res, 'kols', 90)) return
      const wantAll =
        String(req.query.all || '') === '1' ||
        String(req.query.scope || '') === 'admin'
      if (wantAll && !isAdmin(req)) {
        return sendJson(req, res, 401, {
          error: 'unauthorized',
          message: 'Admin token required for full KOL list',
        })
      }
      const data = await r2GetJson<KolsBody>(client, KOLS_OBJECT_KEY)
      if (!data || !Array.isArray(data.kols) || data.kols.length === 0) {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No KOL list on server yet. Save from Admin → Save to server.',
        })
      }
      if (wantAll) return sendJson(req, res, 200, data)
      const pub = publicKolsOnly(data.kols)
      return sendJson(req, res, 200, {
        ...data,
        kols: pub,
        count: pub.length,
      })
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const parsed = parseJsonBody<KolsBody>(req)
      if (!parsed.ok) {
        return jsonError(res, 400, parsed.error, {
          message: 'Body must be JSON with non-empty kols[]',
        })
      }
      const body = parsed.body
      if (!body || !Array.isArray(body.kols) || body.kols.length === 0) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Body must be JSON with non-empty kols[]',
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

      if (
        !(await commitJsonReplace(
          res,
          client,
          KOLS_OBJECT_KEY,
          body as Record<string, unknown>,
          (current) => current?.updatedAt,
          'Server có KOL list mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
      return res.status(200).json({
        ok: true,
        count: body.kols.length,
        updatedAt: payload.updatedAt,
        storage: 'r2',
      })
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req, res)) return
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
