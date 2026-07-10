/**
 * Serve cached tweet images from Cloudflare R2.
 * GET /api/media?id=<hash>
 *
 * If R2_PUBLIC_BASE_URL is set, clients may load images directly from R2;
 * this endpoint still works as a private-bucket proxy.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  mediaObjectKey,
  r2Client,
  r2Configured,
  r2GetObject,
} from '../lib/server/r2'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const id = String(req.query.id || '').trim()
  if (!id || !/^[a-f0-9]{8,64}$/i.test(id)) {
    return res.status(400).json({ error: 'missing_or_invalid_id' })
  }

  if (!r2Configured()) {
    return res.status(503).json({ error: 'r2_not_configured' })
  }

  const client = r2Client()
  if (!client) {
    return res.status(503).json({ error: 'r2_not_configured' })
  }

  try {
    const obj = await r2GetObject(client, mediaObjectKey(id))
    if (!obj) {
      return res.status(404).json({ error: 'not_found' })
    }
    res.setHeader('Content-Type', obj.contentType || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    res.setHeader('X-Media-Source', 'cloudflare-r2')
    return res.status(200).send(obj.body)
  } catch (e) {
    console.error('[api/media]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
