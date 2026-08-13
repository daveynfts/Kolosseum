/**
 * Serve cached tweet images from Cloudflare R2, and proxy other public
 * media keys that are not rewritten to the CDN.
 *
 * GET /api/media?id=<hash>
 * GET /api/media?key=radar/avatars/foo.jpg  (used by /r2/:path* rewrite)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  cors,
  enforcePublicRateLimit,
  isGetOrHead,
  jsonError,
} from '../lib/server/apiHelpers.js'
import {
  isPublicMediaKey,
  mediaObjectKey,
  r2Client,
  r2Configured,
  r2GetObject,
} from '../lib/server/r2.js'

function cacheForKey(key: string): string {
  if (key.startsWith('media/')) {
    return 'public, max-age=31536000, immutable'
  }
  if (key.startsWith('scex-banner/') || key.startsWith('kol-reports/')) {
    return 'public, max-age=120, must-revalidate'
  }
  if (key.startsWith('RadarKOLsReport/')) {
    return 'public, max-age=86400, stale-while-revalidate=604800'
  }
  return 'public, max-age=604800, stale-while-revalidate=86400'
}

async function servePublicKey(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  if (!enforcePublicRateLimit(req, res, 'r2-public', 120)) return res

  const raw = Array.isArray(req.query.key)
    ? req.query.key.join('/')
    : String(req.query.key || '')
  let key = raw.trim().replace(/^\/+/, '')
  try {
    key = decodeURIComponent(key)
  } catch {
    return jsonError(res, 400, 'invalid_key')
  }
  if (!isPublicMediaKey(key)) {
    return jsonError(res, 404, 'not_found')
  }
  if (!r2Configured()) {
    return jsonError(res, 503, 'r2_not_configured')
  }
  const client = r2Client()
  if (!client) {
    return jsonError(res, 503, 'r2_not_configured')
  }

  try {
    const obj = await r2GetObject(client, key)
    if (!obj) {
      return jsonError(res, 404, 'not_found')
    }
    res.setHeader('Content-Type', obj.contentType || 'application/octet-stream')
    res.setHeader('Cache-Control', cacheForKey(key))
    res.setHeader('X-Media-Source', 'cloudflare-r2')
    if (req.method === 'HEAD') return res.status(200).end()
    return res.status(200).send(obj.body)
  } catch (e) {
    console.error('[api/media public-key]', e)
    return jsonError(res, 500, 'server_error', {
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, 'GET, HEAD, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!isGetOrHead(req.method)) {
    return jsonError(res, 405, 'method_not_allowed')
  }

  const hasKey =
    req.query.key !== undefined &&
    String(Array.isArray(req.query.key) ? req.query.key.join('/') : req.query.key)
      .trim() !== ''
  if (hasKey) {
    return servePublicKey(req, res)
  }

  if (!enforcePublicRateLimit(req, res, 'media', 120)) return

  const id = String(req.query.id || '').trim()
  if (!id || !/^[a-f0-9]{8,64}$/i.test(id)) {
    return jsonError(res, 400, 'missing_or_invalid_id')
  }

  if (!r2Configured()) {
    return jsonError(res, 503, 'r2_not_configured')
  }

  const client = r2Client()
  if (!client) {
    return jsonError(res, 503, 'r2_not_configured')
  }

  try {
    const obj = await r2GetObject(client, mediaObjectKey(id))
    if (!obj) {
      return jsonError(res, 404, 'not_found')
    }
    res.setHeader('Content-Type', obj.contentType || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    res.setHeader('X-Media-Source', 'cloudflare-r2')
    if (req.method === 'HEAD') return res.status(200).end()
    return res.status(200).send(obj.body)
  } catch (e) {
    console.error('[api/media]', e)
    return jsonError(res, 500, 'server_error', {
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
