/**
 * Download tweet images and PUT to a stable R2 key (overwrite in place).
 * Reuse an existing media/{id} when the post already has one — no extra objects.
 */
import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const MAX_BYTES = 3_000_000
const UA =
  'Mozilla/5.0 (compatible; VNKolMap/1.0; +https://github.com/daveynfts/VietNamKOLsRadar)'

export function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 24)
}

/** Same photo at ?name=orig vs ?name=large → one R2 object. */
export function canonicalMediaUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return raw
  try {
    const u = new URL(raw)
    if (/pbs\.twimg\.com|video\.twimg\.com|abs\.twimg\.com/i.test(u.hostname)) {
      return `${u.origin}${u.pathname}`
    }
    u.hash = ''
    return u.toString()
  } catch {
    return raw.split('?')[0]
  }
}

export function isR2MediaUrl(u) {
  if (!u || typeof u !== 'string') return false
  if (/pbs\.twimg\.com|twimg\.com|video\.twimg\.com/i.test(u)) return false
  return (
    /\/api\/media\?id=/i.test(u) ||
    /r2\.dev\/media\//i.test(u) ||
    /\/media\/[a-f0-9]{16,}/i.test(u)
  )
}

export function extractR2MediaId(url) {
  const s = String(url || '')
  const q = s.match(/[?&]id=([a-f0-9]{16,})/i)
  if (q) return q[1].toLowerCase()
  const p = s.match(/\/media\/([a-f0-9]{16,})/i)
  return p ? p[1].toLowerCase() : null
}

export function r2FromEnv(env) {
  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  const bucket = env('R2_BUCKET_NAME')
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
    publicBase: (env('R2_PUBLIC_BASE_URL') || env('R2_PUBLIC_URL') || '').replace(
      /\/$/,
      '',
    ),
  }
}

export function mediaPublicUrl(id, publicBase) {
  if (publicBase) return `${publicBase}/media/${id}`
  return `/api/media?id=${encodeURIComponent(id)}`
}

export function extractFxMediaUrls(tweet) {
  const urls = []
  const media = tweet?.media
  if (media?.photos) {
    for (const p of media.photos) {
      if (p?.url) urls.push(p.url)
    }
  }
  if (media?.all) {
    for (const m of media.all) {
      if (m?.url && (m.type === 'photo' || !m.type)) urls.push(m.url)
      else if (m?.thumbnail_url) urls.push(m.thumbnail_url)
    }
  }
  const entities = tweet?.entities
  if (entities?.media) {
    for (const m of entities.media) {
      if (m.media_url_https) urls.push(m.media_url_https)
    }
  }
  return [...new Set(urls.filter(Boolean))]
}

export async function fetchTweetFx(postUrl) {
  const id = String(postUrl).match(/status(?:es)?\/(\d{5,25})/i)?.[1]
  if (!id) return { ok: false, error: 'bad_url' }
  const handle = String(postUrl).match(/(?:x|twitter)\.com\/([^/]+)\/status/i)?.[1]
  const endpoints = [
    `https://api.fxtwitter.com/status/${id}`,
    handle ? `https://api.fxtwitter.com/${handle}/status/${id}` : null,
    `https://api.vxtwitter.com/Twitter/status/${id}`,
  ].filter(Boolean)

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) continue
      const data = await r.json()
      const t = data.tweet || data
      if (t && (t.text || t.full_text || t.id || t.tweetID)) {
        const num = (v) => {
          const n = Number(v)
          return Number.isFinite(n) ? n : 0
        }
        return {
          ok: true,
          tweet: t,
          source: ep,
          text: String(t.text || t.full_text || t.content || ''),
          likes: num(t.likes ?? t.favorite_count ?? t.favourites),
          reposts: num(t.retweets ?? t.retweet_count ?? t.reposts),
          replies: num(t.replies ?? t.reply_count),
          views: num(t.views ?? t.view_count),
          media: extractFxMediaUrls(t),
        }
      }
    } catch {
      /* next endpoint */
    }
  }
  return { ok: false, error: 'fetch_failed' }
}

/**
 * PUT image bytes onto media/{id}. Always replaces the object (no skip-on-HEAD).
 * @param {string} [reuseId] existing 24-hex id from the post — keeps the old key
 */
export async function putImageOverwrite(r2, sourceUrl, reuseId) {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { cachedUrl: sourceUrl, cached: false, error: 'invalid' }
  }
  if (isR2MediaUrl(sourceUrl) && !reuseId) {
    return { cachedUrl: sourceUrl, cached: true, skipped: true }
  }
  const id = reuseId || hashUrl(canonicalMediaUrl(sourceUrl))
  const key = `media/${id}`
  const publicUrl = mediaPublicUrl(id, r2.publicBase)

  if (isR2MediaUrl(sourceUrl)) {
    return { cachedUrl: publicUrl, cached: true, id, skipped: true }
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'image/*,*/*',
        Referer: 'https://x.com/',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      return { cachedUrl: sourceUrl, cached: false, error: `fetch_${res.status}`, id }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.byteLength) {
      return { cachedUrl: sourceUrl, cached: false, error: 'empty', id }
    }
    if (buf.byteLength > MAX_BYTES) {
      return { cachedUrl: sourceUrl, cached: false, error: 'too_large', id }
    }
    let contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return {
        cachedUrl: sourceUrl,
        cached: false,
        error: `not_image_${contentType}`,
        id,
      }
    }
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400',
      }),
    )
    return {
      cachedUrl: publicUrl,
      cached: true,
      id,
      bytes: buf.byteLength,
      overwritten: !!reuseId,
    }
  } catch (e) {
    return {
      cachedUrl: sourceUrl,
      cached: false,
      error: e instanceof Error ? e.message : 'fail',
      id,
    }
  }
}

/**
 * Refresh one feed post's photos onto R2, reusing old media/{id} slots.
 */
export async function hydratePostMedia(r2, post) {
  const oldIds = (Array.isArray(post.media) ? post.media : [])
    .map(extractR2MediaId)
    .filter(Boolean)
  let originals = (Array.isArray(post.media) ? post.media : []).filter(
    (u) => u && !isR2MediaUrl(u) && /^https?:\/\//i.test(u),
  )
  let fx = null
  const hasTwimg = (post.media || []).some((u) => /twimg\.com/i.test(u || ''))
  // Re-fetch X only when we must overwrite an existing R2 object or refresh twimg.
  const needFx = oldIds.length > 0 || hasTwimg

  if (needFx && /\/status\/\d{5,}/i.test(post.url || '')) {
    fx = await fetchTweetFx(post.url)
    if (fx.ok && fx.media?.length) originals = fx.media
  }

  const newMedia = []
  const puts = []
  for (let i = 0; i < Math.min(originals.length, 4); i++) {
    const reuseId = oldIds[i] || null
    const put = await putImageOverwrite(r2, originals[i], reuseId)
    puts.push(put)
    newMedia.push(put.cached ? put.cachedUrl : originals[i])
  }

  const next = { ...post }
  if (fx?.ok) {
    next.media = newMedia
    if (fx.text) next.text = fx.text
    next.likes = fx.likes || next.likes
    next.reposts = fx.reposts || next.reposts
    next.replies = fx.replies || next.replies
    next.views = fx.views || next.views
  } else if (newMedia.length) {
    next.media = newMedia
  }
  return {
    post: next,
    cached: puts.filter((p) => p.cached && !p.skipped).length,
    overwritten: puts.filter((p) => p.overwritten).length,
    failed: puts.filter((p) => !p.cached && !p.skipped).length,
  }
}
