/**
 * Serve cached tweet images from Redis.
 * GET /api/media?id=<hash>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redisClient } from '../lib/server/redis'
import { getCachedMedia } from '../lib/server/mediaCache'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const id = String(req.query.id || '').trim()
  if (!id) {
    return res.status(400).json({ error: 'missing_id' })
  }

  const redis = redisClient()
  if (!redis) {
    return res.status(503).json({ error: 'redis_not_configured' })
  }

  const cached = await getCachedMedia(redis, id)
  if (!cached) {
    return res.status(404).json({ error: 'not_found' })
  }

  const buf = Buffer.from(cached.data, 'base64')
  res.setHeader('Content-Type', cached.contentType || 'image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
  res.setHeader('X-Media-Source', 'redis-cache')
  return res.status(200).send(buf)
}
