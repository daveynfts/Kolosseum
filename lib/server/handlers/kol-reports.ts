/**
 * KOL evaluation reports (text corpus + changelog).
 *
 * GET  /api/kol-reports           — public: only visibility=public
 * GET  /api/kol-reports?all=1     — full dataset (Bearer FEED_ADMIN_TOKEN)
 * PUT  /api/kol-reports           — Bearer FEED_ADMIN_TOKEN (full replace)
 *
 * R2 key: internal/kol-reports/v1.json
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  envPresence,
  KOL_REPORTS_OBJECT_KEY,
  r2Client,
  r2GetJson,
} from '../r2.js'
import {
  commitJsonReplace,
  enforcePublicRateLimit,
  isAdmin,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
  askedAdminSlice,
  serveAdminSlice,
} from '../apiHelpers.js'

type Body = {
  version?: number
  kind?: string
  reports?: unknown[]
  trash?: unknown[]
  updatedAt?: string
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

function publicSlice(data: Body): Body {
  const reports = Array.isArray(data.reports) ? data.reports : []
  const pub = reports
    .filter((r) => {
      if (!r || typeof r !== 'object') return false
      return (r as { visibility?: string }).visibility === 'public'
    })
    .map((r) => {
      const o = r as Record<string, unknown>
      const cl = Array.isArray(o.changelog) ? o.changelog.slice(0, 5) : []
      const { sourceFilename: _sf, sourcePath: _sp, ...rest } = o
      return { ...rest, changelog: cl }
    })
  return {
    version: data.version ?? 1,
    kind: 'kol-reports',
    updatedAt: data.updatedAt || new Date().toISOString(),
    asOf: data.asOf,
    note: 'Public KOL reports only',
    reports: pub,
    trash: [],
  }
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
      if (!enforcePublicRateLimit(req, res, 'kol-reports', 90)) return
      if (askedAdminSlice(req) && !isAdmin(req)) {
        return sendJson(req, res, 401, {
          error: 'unauthorized',
          message: 'Admin token required for full reports dataset',
        })
      }
      const data = await r2GetJson<Body>(client, KOL_REPORTS_OBJECT_KEY)
      if (!data) {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No KOL reports on server yet.',
        })
      }
      if (serveAdminSlice(req)) return sendJson(req, res, 200, data)
      return sendJson(req, res, 200, publicSlice(data))
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const parsed = parseJsonBody<Body>(req)
      if (parsed.ok === false) {
        return jsonError(res, 400, parsed.error)
      }
      const body = parsed.body
      if (!body || typeof body !== 'object') {
        return jsonError(res, 400, 'invalid_body')
      }
      if (!Array.isArray(body.reports)) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Need reports array',
        })
      }
      const payload: Body = {
        ...body,
        version: body.version ?? 1,
        kind: 'kol-reports',
        trash: Array.isArray(body.trash) ? body.trash : [],
        updatedAt: new Date().toISOString(),
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      if (
        !(await commitJsonReplace(
          res,
          client,
          KOL_REPORTS_OBJECT_KEY,
          body as Record<string, unknown>,
          (current) => current?.updatedAt,
          'Server có reports mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
      return res.status(200).json({
        ok: true,
        reports: (payload.reports as unknown[]).length,
        trash: (payload.trash as unknown[]).length,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key: KOL_REPORTS_OBJECT_KEY,
      })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/kol-reports]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
