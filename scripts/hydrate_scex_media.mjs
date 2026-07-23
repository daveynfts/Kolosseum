/**
 * Cache SCEX livefeed tweet media to R2 (same idea as map feed).
 *
 * Default: local pipeline (fxtwitter → download → R2 media/{hash}) using
 * R2_* from .env — no browser/runtime X calls later.
 *
 *   node scripts/hydrate_scex_media.mjs
 *   node scripts/hydrate_scex_media.mjs --put
 *   node scripts/hydrate_scex_media.mjs --force
 *   node scripts/hydrate_scex_media.mjs --via-api   # use production /api/x-status
 *   node scripts/hydrate_scex_media.mjs --limit 10
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1)
    if (v && (!process.env[k] || process.env[k] === '')) process.env[k] = v
  }
}
loadEnv('.env.local')
loadEnv('.env.production.local')

function env(k) {
  const v = process.env[k]
  if (!v) return ''
  return v.trim().replace(/^["']|["']$/g, '')
}

const token = env('FEED_ADMIN_TOKEN')
const base = (env('RADAR_API_BASE') || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)
const doPut = process.argv.includes('--put')
const force = process.argv.includes('--force')
const viaApi = process.argv.includes('--via-api')

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  if (v == null || v.startsWith('--')) return fallback
  return v
}
const limit = Number(argVal('--limit', '0')) || 0
const concurrency = Math.max(
  1,
  Math.min(4, Number(argVal('--concurrency', '2')) || 2),
)

const seedPaths = [
  path.join(ROOT, 'src/data/internal/scex-tracking.json'),
  path.join(ROOT, 'data/internal/scex-tracking.json'),
]

const MAX_BYTES = 2_000_000

function isR2MediaUrl(u) {
  if (!u || typeof u !== 'string') return false
  if (/pbs\.twimg\.com|twimg\.com|video\.twimg\.com/i.test(u)) return false
  return (
    /\/api\/media\?id=/i.test(u) ||
    /r2\.dev\/media\//i.test(u) ||
    /\/media\/[a-f0-9]{16,}/i.test(u)
  )
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 24)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function r2Client() {
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
    publicBase: (env('R2_PUBLIC_BASE_URL') || env('R2_PUBLIC_URL')).replace(
      /\/$/,
      '',
    ),
  }
}

function mediaPublicUrl(id, publicBase) {
  if (publicBase) return `${publicBase}/media/${id}`
  return `/api/media?id=${encodeURIComponent(id)}`
}

async function cacheImageToR2(r2, sourceUrl) {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { cachedUrl: sourceUrl, cached: false, error: 'invalid' }
  }
  if (isR2MediaUrl(sourceUrl)) {
    return { cachedUrl: sourceUrl, cached: true }
  }
  const id = hashUrl(sourceUrl)
  const key = `media/${id}`
  try {
    await r2.client.send(
      new HeadObjectCommand({ Bucket: r2.bucket, Key: key }),
    )
    return { cachedUrl: mediaPublicUrl(id, r2.publicBase), cached: true, id }
  } catch {
    /* not exists */
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
      return { cachedUrl: sourceUrl, cached: false, error: `fetch_${res.status}` }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) {
      return {
        cachedUrl: sourceUrl,
        cached: false,
        error: buf.byteLength ? 'too_large' : 'empty',
      }
    }
    let contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return { cachedUrl: sourceUrl, cached: false, error: `not_image_${contentType}` }
    }
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return { cachedUrl: mediaPublicUrl(id, r2.publicBase), cached: true, id }
  } catch (e) {
    return {
      cachedUrl: sourceUrl,
      cached: false,
      error: e instanceof Error ? e.message : 'fail',
    }
  }
}

function extractMediaUrls(tweet) {
  const urls = []
  const media = tweet.media
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
  const entities = tweet.entities
  if (entities?.media) {
    for (const m of entities.media) {
      if (m.media_url_https) urls.push(m.media_url_https)
    }
  }
  return Array.from(new Set(urls.filter(Boolean)))
}

function parseStatusId(url) {
  const m = String(url).match(/status(?:es)?\/(\d{5,25})/i)
  return m ? m[1] : null
}

async function fetchTweetLocal(url) {
  const id = parseStatusId(url)
  if (!id) return { ok: false, error: 'bad_url' }
  const handleMatch = String(url).match(
    /(?:x|twitter)\.com\/([^/]+)\/status/i,
  )
  const handle = handleMatch?.[1]
  const endpoints = [
    `https://api.fxtwitter.com/status/${id}`,
    handle ? `https://api.fxtwitter.com/${handle}/status/${id}` : null,
    `https://api.vxtwitter.com/Twitter/status/${id}`,
  ].filter(Boolean)

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (compatible; VNKolMap/1.0; +https://github.com/daveynfts/VietNamKOLsRadar)',
        },
      })
      if (!r.ok) continue
      const data = await r.json()
      const t = data.tweet || data
      if (t && (t.text || t.full_text || t.id || t.tweetID)) {
        return { ok: true, tweet: t, source: ep }
      }
    } catch {
      /* try next */
    }
  }
  return { ok: false, error: 'fetch_failed' }
}

async function hydrateLocal(r2, postUrl) {
  const got = await fetchTweetLocal(postUrl)
  if (!got.ok) return { ok: false, error: got.error }
  const tweet = got.tweet
  const original = extractMediaUrls(tweet)
  const media = []
  for (const m of original.slice(0, 4)) {
    const c = await cacheImageToR2(r2, m)
    media.push(c.cachedUrl)
  }
  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return {
    ok: true,
    media,
    likes: num(tweet.likes ?? tweet.favorite_count ?? tweet.favourites),
    reposts: num(tweet.retweets ?? tweet.retweet_count ?? tweet.reposts),
    replies: num(tweet.replies ?? tweet.reply_count),
    views: num(tweet.views ?? tweet.view_count),
    text: String(tweet.text || tweet.full_text || tweet.content || ''),
    createdAt: tweet.created_at || tweet.createdAt || tweet.date,
    originalCount: original.length,
    r2Count: media.filter(isR2MediaUrl).length,
  }
}

async function hydrateViaApi(postUrl) {
  const api = `${base}/api/x-status?url=${encodeURIComponent(postUrl)}`
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(api, { headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.post) {
    return {
      ok: false,
      error: body.message || body.error || `HTTP ${res.status}`,
    }
  }
  const p = body.post
  const media = [
    ...(Array.isArray(p.mediaCached) ? p.mediaCached : []),
    ...(Array.isArray(p.media) ? p.media : []),
  ].filter(Boolean)
  // Prefer R2 URLs; fall back to any https image if cache missed
  const r2Only = media.filter(isR2MediaUrl)
  const anyMedia = Array.from(new Set(media)).slice(0, 4)
  return {
    ok: true,
    media: r2Only.length ? Array.from(new Set(r2Only)).slice(0, 4) : anyMedia,
    likes: p.likes,
    reposts: p.reposts,
    replies: p.replies,
    views: p.views,
    text: p.text,
    createdAt: p.createdAt,
    originalCount: (p.mediaOriginal || p.media || []).length,
    r2Count: r2Only.length,
  }
}

async function main() {
  const dataset = JSON.parse(fs.readFileSync(seedPaths[0], 'utf8'))
  const posts = Array.isArray(dataset.posts) ? dataset.posts : []
  let targets = posts.filter((p) => p && p.url && !p.hidden)
  if (!force) {
    // Need hydrate if missing R2 media OR placeholder / empty text
    targets = targets.filter((p) => {
      const hasR2 =
        Array.isArray(p.media) && p.media.length > 0 && p.media.some(isR2MediaUrl)
      const text = String(p.text || '')
      const placeholder =
        !text.trim() ||
        /export gốc|mention SCEX \(export/i.test(text) ||
        text.length < 12
      return !hasR2 || placeholder
    })
  }
  if (limit > 0) targets = targets.slice(0, limit)

  const r2 = viaApi ? null : r2Client()
  if (!viaApi && !r2) {
    console.error('R2 credentials missing — set R2_* in .env.local or use --via-api')
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        mode: viaApi ? 'via-api' : 'local-r2',
        base,
        publicBase: r2?.publicBase || null,
        totalPosts: posts.length,
        toHydrate: targets.length,
        force,
        concurrency,
        put: doPut,
      },
      null,
      2,
    ),
  )

  const byId = new Map(posts.map((p) => [p.id, p]))
  let ok = 0
  let withMedia = 0
  let fail = 0
  let i = 0

  async function worker() {
    while (i < targets.length) {
      const idx = i++
      const p = targets[idx]
      process.stdout.write(
        `[${idx + 1}/${targets.length}] ${p.handle} ${p.id} … `,
      )
      try {
        const r = viaApi
          ? await hydrateViaApi(p.url)
          : await hydrateLocal(r2, p.url)
        if (!r.ok) {
          fail++
          console.log('FAIL', r.error)
          await sleep(300)
          continue
        }
        const cur = byId.get(p.id) || p
        // Keep previous R2 media if new fetch returned empty
        if (r.media?.length) cur.media = r.media
        else if (!Array.isArray(cur.media)) cur.media = []
        if (r.likes != null) cur.likes = Number(r.likes) || 0
        if (r.reposts != null) cur.reposts = Number(r.reposts) || 0
        if (r.replies != null) cur.replies = Number(r.replies) || 0
        if (r.views != null) cur.views = Number(r.views) || 0
        // Always prefer live tweet text when present
        if (r.text && String(r.text).trim()) {
          cur.text = String(r.text).trim()
        }
        if (r.createdAt) {
          const t = new Date(r.createdAt).getTime()
          if (!Number.isNaN(t)) cur.postedAt = new Date(t).toISOString()
        }
        cur.notes = [String(cur.notes || '').replace(/\s*·\s*media→R2/g, ''), 'media→R2']
          .filter(Boolean)
          .join(' · ')
        byId.set(p.id, cur)
        ok++
        if (cur.media.length) withMedia++
        console.log(
          'ok',
          `media=${cur.media.length}`,
          cur.media[0]
            ? isR2MediaUrl(cur.media[0])
              ? 'R2'
              : 'remote'
            : 'none',
          `orig=${r.originalCount} r2=${r.r2Count}`,
        )
      } catch (e) {
        fail++
        console.log('ERR', e instanceof Error ? e.message : e)
      }
      await sleep(280)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  dataset.posts = posts.map((p) => byId.get(p.id) || p)
  dataset.updatedAt = new Date().toISOString()
  const r2Posts = dataset.posts.filter((p) =>
    (p.media || []).some(isR2MediaUrl),
  ).length
  dataset.note = [
    String(dataset.note || '')
      .replace(/\s*Media hydrated[^.]*\.?/gi, '')
      .replace(/\s*·\s*media→R2/gi, '')
      .trim(),
    `Media on R2: ${r2Posts}/${dataset.posts.length} posts (hydrate_scex_media).`,
  ]
    .filter(Boolean)
    .join(' ')

  const json = JSON.stringify(dataset, null, 2) + '\n'
  for (const p of seedPaths) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, json, 'utf8')
    console.log('wrote', p)
  }

  console.log(
    JSON.stringify(
      {
        ok,
        fail,
        withMedia,
        r2MediaPosts: r2Posts,
        sample: dataset.posts.find((p) => p.media?.length)?.media?.[0] || null,
      },
      null,
      2,
    ),
  )

  if (doPut) {
    if (!token) {
      console.error('FEED_ADMIN_TOKEN missing — cannot PUT')
      process.exitCode = 1
      return
    }
    const putRes = await fetch(`${base}/api/scex-tracking`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataset),
    })
    const body = await putRes.text()
    console.log('PUT /api/scex-tracking', putRes.status, body.slice(0, 280))
    if (!putRes.ok) process.exitCode = 1
    else {
      const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
      const got = await getRes.json()
      const mediaN = (got.posts || []).filter((p) =>
        (p.media || []).some(isR2MediaUrl),
      ).length
      console.log('GET verify', {
        status: getRes.status,
        posts: got.posts?.length,
        r2MediaPosts: mediaN,
        sample: got.posts?.find((p) => p.media?.length)?.media?.[0],
      })
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
