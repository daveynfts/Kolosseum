/**
 * Internal TwitterScore Top 100 benchmark (admin-editable).
 *
 * GET  /api/twitterscore-top100 — public read
 * PUT  /api/twitterscore-top100 — Bearer FEED_ADMIN_TOKEN
 *
 * R2 key: internal/twitterscore-top100/v1.json
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  envPresence,
  TWITTERSCORE_TOP100_OBJECT_KEY,
  r2Client,
  r2GetJson,
} from '../lib/server/r2.js'
import {
  commitJsonReplace,
  enforcePublicRateLimit,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
} from '../lib/server/apiHelpers.js'

type Body = {
  version?: number
  kind?: string
  asOf?: string
  source?: string
  sourceNote?: string
  maxScore?: number
  top100Threshold?: number
  median?: number
  mean?: number
  atMax?: number
  accounts?: unknown[]
  updatedAt?: string
  note?: string
  baseUpdatedAt?: string
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
  return Array.isArray(body.accounts) && body.accounts.length > 0
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
      if (!enforcePublicRateLimit(req, res, 'twitterscore-top100', 90)) return
      const data = await r2GetJson<Body>(
        client,
        TWITTERSCORE_TOP100_OBJECT_KEY,
      )
      if (!data || !Array.isArray(data.accounts) || !data.accounts.length) {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No TwitterScore Top 100 on server yet.',
        })
      }
      return sendJson(req, res, 200, data)
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return
      const parsed = parseJsonBody<Body>(req)
      if (!parsed.ok) {
        return jsonError(res, 400, parsed.error, {
          message: 'Need accounts[] with at least 1 row',
        })
      }
      const body = parsed.body
      if (!isValidBody(body)) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Need accounts[] with at least 1 row',
        })
      }
      const payload: Body = {
        ...body,
        version: body.version ?? 1,
        kind: 'twitterscore-top100',
        updatedAt: new Date().toISOString(),
        source: body.source || 'admin server',
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      if (
        !(await commitJsonReplace(
          res,
          client,
          TWITTERSCORE_TOP100_OBJECT_KEY,
          body as Record<string, unknown>,
          (current) => current?.updatedAt,
          'Server có TwitterScore mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
      return res.status(200).json({
        ok: true,
        count: Array.isArray(payload.accounts) ? payload.accounts.length : 0,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key: TWITTERSCORE_TOP100_OBJECT_KEY,
      })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('[api/twitterscore-top100]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : 'unknown',
    })
  }
}
