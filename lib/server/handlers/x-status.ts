/**
 * Fetch X status by URL (snapshot) via fxtwitter; cache photos on Cloudflare R2.
 *
 * GET /api/x-status?url=https://x.com/user/status/123
 * Public read (no auth) so SCEX livefeed can hydrate media.
 * Optional Authorization: Bearer FEED_ADMIN_TOKEN still accepted.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { r2Client } from '../r2.js'
import { cacheRemoteImage } from '../mediaCache.js'
import {
  cors as applyCors,
  enforcePublicRateLimit,
  isAdmin,
  isGetOrHead,
  jsonError,
  sendJson,
} from '../apiHelpers.js'

type TweetOut = {
  id: string
  handle: string
  displayName: string
  text: string
  createdAt: string
  likes: number
  reposts: number
  replies: number
  views: number
  media: string[]
  mediaOriginal: string[]
  mediaCached: string[]
  isReply: boolean
  url: string
  avatarLocal: string
  avatarRemote?: string
  fetchedAt: string
  source: string
}

function parseXStatusUrl(raw: string): { id: string; handle?: string } | null {
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.replace(/^www\./, '')
    if (
      !['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com'].includes(
        host,
      )
    ) {
      if (/^\d{5,25}$/.test(raw.trim())) return { id: raw.trim() }
      return null
    }
    const m = u.pathname.match(
      /\/(?:i\/web\/)?(?:([^/]+)\/)?status(?:es)?\/(\d{5,25})/i,
    )
    if (!m) return null
    const handle = m[1] && m[1] !== 'i' && m[1] !== 'web' ? m[1] : undefined
    return { id: m[2], handle }
  } catch {
    if (/^\d{5,25}$/.test(raw.trim())) return { id: raw.trim() }
    return null
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function extractMediaUrls(tweet: Record<string, unknown>): string[] {
  const urls: string[] = []
  const media = tweet.media as
    | {
        all?: Array<{ url?: string; type?: string; thumbnail_url?: string }>
        photos?: Array<{ url?: string }>
      }
    | undefined
  if (media?.photos) {
    for (const p of media.photos) {
      if (p?.url) urls.push(p.url)
    }
  }
  if (media?.all) {
    for (const m of media.all) {
      if (m?.url && (m.type === 'photo' || !m.type)) urls.push(m.url)
      if (m?.thumbnail_url) urls.push(m.thumbnail_url)
    }
  }
  const entities = tweet.entities as
    | { media?: Array<{ media_url_https?: string }> }
    | undefined
  if (entities?.media) {
    for (const m of entities.media) {
      if (m.media_url_https) urls.push(m.media_url_https)
    }
  }
  return Array.from(new Set(urls.filter(Boolean)))
}

function toIso(created: unknown): string {
  if (!created) return new Date().toISOString()
  if (typeof created === 'string' || typeof created === 'number') {
    const d = new Date(created)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, 'GET, HEAD, OPTIONS', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!isGetOrHead(req.method)) {
    return jsonError(res, 405, 'method_not_allowed')
  }
  if (!enforcePublicRateLimit(req, res, 'x-status', 40)) return

  // Public read; R2 image cache only when admin token present (prevents open fetch-to-R2 abuse).
  const allowR2Cache = isAdmin(req)

  const rawUrl = String(req.query.url || req.query.u || '').trim()
  if (!rawUrl) {
    return sendJson(req, res, 400, {
      error: 'missing_url',
      message: 'Pass ?url=https://x.com/user/status/ID',
    })
  }

  const parsed = parseXStatusUrl(rawUrl)
  if (!parsed) {
    return sendJson(req, res, 400, {
      error: 'invalid_url',
      message: 'Not a valid X/Twitter status URL',
    })
  }

  const endpoints = [
    `https://api.fxtwitter.com/status/${parsed.id}`,
    parsed.handle
      ? `https://api.fxtwitter.com/${parsed.handle}/status/${parsed.id}`
      : null,
    `https://api.vxtwitter.com/Twitter/status/${parsed.id}`,
  ].filter(Boolean) as string[]

  let tweet: Record<string, unknown> | null = null
  let sourceUsed = ''
  const errors: string[] = []

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (compatible; VNKolMap/1.0; +https://github.com/daveynfts/VietNamKOLsRadar)',
        },
      })
      if (!r.ok) {
        errors.push(`${ep} → ${r.status}`)
        continue
      }
      const data = (await r.json()) as Record<string, unknown>
      const t = (data.tweet || data) as Record<string, unknown>
      if (t && (t.text || t.full_text || t.id || t.tweetID)) {
        tweet = t
        sourceUsed = ep
        break
      }
      errors.push(`${ep} → empty`)
    } catch (e) {
      errors.push(`${ep} → ${e instanceof Error ? e.message : 'fail'}`)
    }
  }

  if (!tweet) {
    return sendJson(req, res, 502, {
      error: 'fetch_failed',
      message: 'Could not load status from fxtwitter/vxtwitter',
      errors,
    })
  }

  const author = (tweet.author || tweet.user || {}) as Record<string, unknown>
  const handle = String(
    author.screen_name ||
      author.username ||
      parsed.handle ||
      tweet.user_screen_name ||
      'unknown',
  ).replace(/^@/, '')
  const displayName = String(author.name || author.display_name || handle)
  const text = String(tweet.text || tweet.full_text || tweet.content || '')
  const id = String(tweet.id || tweet.tweetID || parsed.id)
  const likes = num(tweet.likes ?? tweet.favorite_count ?? tweet.favourites)
  const reposts = num(tweet.retweets ?? tweet.retweet_count ?? tweet.reposts)
  const replies = num(tweet.replies ?? tweet.reply_count)
  const views = num(tweet.views ?? tweet.view_count)
  const createdAt = toIso(
    tweet.created_at || tweet.createdAt || tweet.date || tweet.timestamp,
  )
  const isReply = !!(
    tweet.replying_to ||
    tweet.in_reply_to_status_id ||
    tweet.is_reply
  )
  const url = `https://x.com/${handle}/status/${id}`
  const avatarRemote = String(
    author.avatar_url ||
      author.profile_image_url_https ||
      author.profile_image_url ||
      '',
  ).replace('_normal.', '_400x400.')

  const mediaOriginal = extractMediaUrls(tweet)
  const mediaCached: string[] = []
  const client = r2Client()

  if (client && allowR2Cache && mediaOriginal.length) {
    for (const m of mediaOriginal.slice(0, 4)) {
      const result = await cacheRemoteImage(client, m)
      mediaCached.push(result.cachedUrl)
    }
  }

  const media =
    mediaCached.length > 0 ? mediaCached : mediaOriginal.slice(0, 4)

  if (client && allowR2Cache && avatarRemote) {
    await cacheRemoteImage(client, avatarRemote)
  }

  const out: TweetOut = {
    id,
    handle,
    displayName,
    text,
    createdAt,
    likes,
    reposts,
    replies,
    views,
    media,
    mediaOriginal,
    mediaCached: mediaCached.filter((u) => {
      // Count only R2/proxy URLs — not raw pbs.twimg.com/media/…
      if (!u) return false
      if (/pbs\.twimg\.com|twimg\.com/i.test(u)) return false
      return (
        u.includes('/api/media') ||
        /\/media\/[a-f0-9]{16,}/i.test(u)
      )
    }),
    isReply,
    url,
    avatarLocal: `/avatars/${handle}.jpg`,
    avatarRemote: avatarRemote || undefined,
    fetchedAt: new Date().toISOString(),
    source: sourceUsed || 'fxtwitter',
  }

  return sendJson(req, res, 200, {
    ok: true,
    post: out,
    cache: {
      storage: 'cloudflare-r2',
      r2: !!client,
      imagesCached: out.mediaCached.length,
      imagesTotal: mediaOriginal.length,
    },
  })
}
