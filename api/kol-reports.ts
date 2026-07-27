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
  env,
  envPresence,
  KOL_REPORTS_OBJECT_KEY,
  r2Client,
  r2GetJson,
  r2PutJson,
} from '../lib/server/r2.js'
import {
  assertNotStale,
  bearer,
  readBaseUpdatedAt,
} from '../lib/server/apiHelpers.js'

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function isAdmin(req: VercelRequest): boolean {
  const secret = env('FEED_ADMIN_TOKEN')
  if (!secret) return false
  return bearer(req) === secret
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
    if (req.method === 'GET') {
      const wantAll =
        String(req.query.all || '') === '1' ||
        String(req.query.scope || '') === 'admin'
      if (wantAll && !isAdmin(req)) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Admin token required for full reports dataset',
        })
      }
      const data = await r2GetJson<Body>(client, KOL_REPORTS_OBJECT_KEY)
      if (!data) {
        return res.status(404).json({
          error: 'empty',
          message: 'No KOL reports on server yet.',
        })
      }
      if (wantAll) return res.status(200).json(data)
      return res.status(200).json(publicSlice(data))
    }

    if (req.method === 'PUT') {
      if (!isAdmin(req)) {
        return res.status(401).json({ error: 'unauthorized' })
      }
      const body = (
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      ) as Body
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'invalid_body' })
      }
      if (!Array.isArray(body.reports)) {
        return res.status(400).json({
          error: 'invalid_body',
          message: 'Need reports array',
        })
      }
      const current = await r2GetJson<Body>(client, KOL_REPORTS_OBJECT_KEY)
      const stale = assertNotStale(
        current?.updatedAt,
        readBaseUpdatedAt(body as Record<string, unknown>),
      )
      if (!stale.ok) {
        return res.status(409).json({
          error: 'conflict',
          message: 'Server có reports mới hơn. Reload rồi Save lại.',
          serverUpdatedAt: stale.serverUpdatedAt,
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
      await r2PutJson(client, KOL_REPORTS_OBJECT_KEY, payload)
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
