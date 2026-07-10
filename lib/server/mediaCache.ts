import { createHash } from 'crypto'
import type { Redis } from '@upstash/redis'

export type CachedMedia = {
  id: string
  contentType: string
  /** base64 payload (no data: prefix) */
  data: string
  sourceUrl: string
  byteLength: number
  createdAt: string
}

const MEDIA_PREFIX = 'vn-kol-map:media:v1:'
/** Soft cap ~1.2MB raw → ~1.6MB base64 — skip huge videos/files */
const MAX_BYTES = 1_200_000

export function mediaRedisKey(id: string) {
  return `${MEDIA_PREFIX}${id}`
}

export function mediaPublicPath(id: string) {
  return `/api/media?id=${encodeURIComponent(id)}`
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24)
}

/**
 * Download remote image and store in Redis. Returns public /api/media?id= path.
 * On failure returns original URL (caller may still keep it).
 */
export async function cacheRemoteImage(
  redis: Redis,
  sourceUrl: string,
): Promise<{ cachedUrl: string; id: string | null; cached: boolean; error?: string }> {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { cachedUrl: sourceUrl, id: null, cached: false, error: 'invalid_url' }
  }
  // Already our cache
  if (sourceUrl.includes('/api/media')) {
    return { cachedUrl: sourceUrl, id: null, cached: true }
  }

  const id = hashUrl(sourceUrl)
  const key = mediaRedisKey(id)

  try {
    const existing = await redis.get<CachedMedia>(key)
    if (existing?.data) {
      return { cachedUrl: mediaPublicPath(id), id, cached: true }
    }
  } catch {
    /* continue download */
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; VNKolMap/1.0; +https://github.com/daveynfts/VietNamKOLsRadar)',
        Accept: 'image/*,*/*',
      },
    })
    if (!res.ok) {
      return {
        cachedUrl: sourceUrl,
        id: null,
        cached: false,
        error: `fetch_${res.status}`,
      }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0) {
      return { cachedUrl: sourceUrl, id: null, cached: false, error: 'empty_body' }
    }
    if (buf.byteLength > MAX_BYTES) {
      return {
        cachedUrl: sourceUrl,
        id: null,
        cached: false,
        error: `too_large_${buf.byteLength}`,
      }
    }

    const contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() ||
      guessType(sourceUrl) ||
      'image/jpeg'

    // Only cache images (skip mp4 etc. for size/complexity)
    if (!contentType.startsWith('image/')) {
      return {
        cachedUrl: sourceUrl,
        id: null,
        cached: false,
        error: `not_image_${contentType}`,
      }
    }

    const payload: CachedMedia = {
      id,
      contentType,
      data: buf.toString('base64'),
      sourceUrl,
      byteLength: buf.byteLength,
      createdAt: new Date().toISOString(),
    }

    // TTL 180 days — refresh if re-fetched
    await redis.set(key, payload, { ex: 60 * 60 * 24 * 180 })

    return { cachedUrl: mediaPublicPath(id), id, cached: true }
  } catch (e) {
    return {
      cachedUrl: sourceUrl,
      id: null,
      cached: false,
      error: e instanceof Error ? e.message : 'download_failed',
    }
  }
}

export async function getCachedMedia(
  redis: Redis,
  id: string,
): Promise<CachedMedia | null> {
  if (!id || !/^[a-f0-9]{8,64}$/i.test(id)) return null
  try {
    const data = await redis.get<CachedMedia>(mediaRedisKey(id))
    if (!data?.data) return null
    return data
  } catch {
    return null
  }
}

function guessType(url: string): string | null {
  const u = url.toLowerCase()
  if (u.includes('.png')) return 'image/png'
  if (u.includes('.webp')) return 'image/webp'
  if (u.includes('.gif')) return 'image/gif'
  if (u.includes('.jpg') || u.includes('.jpeg')) return 'image/jpeg'
  return null
}
