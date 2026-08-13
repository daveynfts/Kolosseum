import { createHash } from 'crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import {
  mediaObjectKey,
  mediaPublicUrl,
  r2Exists,
  r2PutBytes,
} from './r2.js'

/** Soft cap ~3MB (tweet media + Luma event covers) */
const MAX_BYTES = 3_000_000

/** Only cache images from known hosts (blocks open fetch-to-R2 abuse). */
const ALLOWED_IMAGE_HOSTS = new Set([
  'pbs.twimg.com',
  'video.twimg.com',
  'abs.twimg.com',
  'ton.twimg.com',
  // Luma event covers (Conviction side events)
  'images.lumacdn.com',
  'cdn.lu.ma',
  'images.luma.com',
])

function isAllowedImageUrl(sourceUrl: string): boolean {
  try {
    const u = new URL(sourceUrl)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    return ALLOWED_IMAGE_HOSTS.has(host)
  } catch {
    return false
  }
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24)
}

/**
 * Normalize Luma CDN URL to a stable 1:1 square cover for caching.
 * Different width/height query params map to the same R2 object.
 */
export function normalizeEventImageFetchUrl(
  sourceUrl: string,
  size = 640,
): string {
  const u = (sourceUrl || '').trim()
  if (!u) return u
  if (u.includes('lumacdn.com/cdn-cgi/image/')) {
    return u
      .replace(/width=\d+(\.\d+)?/gi, `width=${size}`)
      .replace(/height=\d+(\.\d+)?/gi, `height=${size}`)
  }
  const m = u.match(
    /images\.lumacdn\.com\/((?:uploads|gallery-images|event-covers)\/[^?#]+)/i,
  )
  if (m) {
    const path = m[1].replace(/^\//, '')
    return (
      `https://images.lumacdn.com/cdn-cgi/image/` +
      `format=auto,fit=cover,dpr=1,background=white,quality=75,` +
      `width=${size},height=${size}/${path}`
    )
  }
  return u
}

/** Stable hash key for cache identity (Luma asset path without size). */
function cacheIdentityKey(sourceUrl: string): string {
  const m = sourceUrl.match(
    /images\.lumacdn\.com\/(?:cdn-cgi\/image\/[^/]+\/)?((?:uploads|gallery-images|event-covers)\/[^?#]+)/i,
  )
  if (m) return `luma:${m[1].toLowerCase()}`
  return sourceUrl
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
  if (!isAllowedImageUrl(sourceUrl)) {
    return {
      cachedUrl: sourceUrl,
      id: null,
      cached: false,
      error: 'host_not_allowed',
    }
  }

  const fetchUrl = normalizeEventImageFetchUrl(sourceUrl, 640)
  const id = hashUrl(cacheIdentityKey(fetchUrl))
  const key = mediaObjectKey(id)

  try {
    if (await r2Exists(client, key)) {
      return { cachedUrl: mediaPublicUrl(id), id, cached: true }
    }
  } catch {
    return {
      cachedUrl: sourceUrl,
      id: null,
      cached: false,
      error: 'r2_head_failed',
    }
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; VNKolMap/1.0; +https://github.com/daveynfts/VietNamKOLsRadar)',
        Accept: 'image/*,*/*',
        Referer: 'https://lu.ma/',
      },
      signal: AbortSignal.timeout(12000),
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
      guessType(fetchUrl) ||
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

/**
 * Cache Luma (or other allowed) imageUrls on side-event objects.
 * Best-effort: keeps original URL if cache fails. Time-budget for serverless.
 */
export async function cacheEventImageUrls<
  T extends { imageUrl?: string | null },
>(
  client: S3Client,
  events: T[],
  opts?: { deadlineMs?: number },
): Promise<{ events: T[]; cached: number; failed: number }> {
  const deadline = Date.now() + (opts?.deadlineMs ?? 8_000)
  let cached = 0
  let failed = 0
  const out: T[] = []
  for (const ev of events) {
    const url = typeof ev.imageUrl === 'string' ? ev.imageUrl.trim() : ''
    if (!url) {
      out.push(ev)
      continue
    }
    if (isOurMediaUrl(url)) {
      out.push(ev)
      cached++
      continue
    }
    if (Date.now() > deadline) {
      out.push(ev)
      continue
    }
    const result = await cacheRemoteImage(client, url)
    if (result.cached && result.cachedUrl && result.cachedUrl !== url) {
      out.push({ ...ev, imageUrl: result.cachedUrl })
      cached++
    } else if (result.cached) {
      out.push(ev)
      cached++
    } else {
      out.push(ev)
      failed++
    }
  }
  return { events: out, cached, failed }
}

function guessType(url: string): string | null {
  const u = url.toLowerCase()
  if (u.includes('.png')) return 'image/png'
  if (u.includes('.webp')) return 'image/webp'
  if (u.includes('.gif')) return 'image/gif'
  if (u.includes('.jpg') || u.includes('.jpeg')) return 'image/jpeg'
  return null
}

/** True only for our R2/proxy media URLs — not Twitter / Luma CDN. */
export function isOurMediaUrl(sourceUrl: string): boolean {
  if (!sourceUrl) return false
  // Same-origin API proxy
  if (/\/api\/media\?id=/i.test(sourceUrl)) return true
  // Known third-party hosts that are NOT ours
  if (
    /pbs\.twimg\.com|twimg\.com|video\.twimg\.com|lumacdn\.com|lu\.ma|luma\.com/i.test(
      sourceUrl,
    )
  ) {
    return false
  }
  try {
    const u = new URL(sourceUrl, 'https://local.invalid')
    // R2 public: …/media/{sha24hex} (optional extension)
    if (/^\/media\/[a-f0-9]{16,}(?:\.[a-z0-9]+)?$/i.test(u.pathname)) return true
    // Relative /api/media?id=
    if (u.pathname === '/api/media' && u.searchParams.has('id')) return true
    // Cloudflare R2.dev public buckets
    if (/\.r2\.dev$/i.test(u.hostname) && /\/media\//i.test(u.pathname)) {
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}
