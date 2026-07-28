/**
 * Serve cached tweet images from Cloudflare R2.
 * GET /api/media?id=<hash>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  cors,
  enforcePublicRateLimit,
  jsonError,
} from '../lib/server/apiHelpers.js'
import {
  mediaObjectKey,
  r2Client,
  r2Configured,
  r2GetObject,
} from '../lib/server/r2.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'method_not_allowed')
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
    return res.status(200).send(obj.body)
  } catch (e) {
    console.error('[api/media]', e)
    return jsonError(res, 500, 'server_error', {
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
