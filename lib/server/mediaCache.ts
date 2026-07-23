import { createHash } from 'crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import {
  mediaObjectKey,
  mediaPublicUrl,
  r2Exists,
  r2PutBytes,
} from './r2.js'

/** Soft cap ~2MB per image for admin-curated feed */
const MAX_BYTES = 2_000_000

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24)
}

/**
 * Download remote image → store on R2 → return public/proxy URL.
 * On failure returns original URL.
 */
export async function cacheRemoteImage(
  client: S3Client,
  sourceUrl: string,
): Promise<{ cachedUrl: string; id: string | null; cached: boolean; error?: string }> {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { cachedUrl: sourceUrl, id: null, cached: false, error: 'invalid_url' }
  }
  // Already our cached media (proxy or R2). Do NOT match pbs.twimg.com/media/…
  if (isOurMediaUrl(sourceUrl)) {
    return { cachedUrl: sourceUrl, id: null, cached: true }
  }

  const id = hashUrl(sourceUrl)
  const key = mediaObjectKey(id)

  try {
    if (await r2Exists(client, key)) {
      return { cachedUrl: mediaPublicUrl(id), id, cached: true }
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

    if (!contentType.startsWith('image/')) {
      return {
        cachedUrl: sourceUrl,
        id: null,
        cached: false,
        error: `not_image_${contentType}`,
      }
    }

    await r2PutBytes(client, key, buf, contentType)
    return { cachedUrl: mediaPublicUrl(id), id, cached: true }
  } catch (e) {
    return {
      cachedUrl: sourceUrl,
      id: null,
      cached: false,
      error: e instanceof Error ? e.message : 'download_failed',
    }
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

/** True only for our R2/proxy media URLs — not Twitter pbs.twimg.com/media/… */
export function isOurMediaUrl(sourceUrl: string): boolean {
  if (!sourceUrl) return false
  // Same-origin API proxy
  if (/\/api\/media\?id=/i.test(sourceUrl)) return true
  // Known third-party hosts that are NOT ours
  if (/pbs\.twimg\.com|twimg\.com|video\.twimg\.com/i.test(sourceUrl)) {
    return false
  }
  try {
    const u = new URL(sourceUrl, 'https://local.invalid')
    // R2 public: …/media/{sha24hex} (optional extension)
    if (/^\/media\/[a-f0-9]{16,}(?:\.[a-z0-9]+)?$/i.test(u.pathname)) return true
    // Relative /api/media?id=
    if (u.pathname === '/api/media' && u.searchParams.has('id')) return true
  } catch {
    /* ignore */
  }
  return false
}
