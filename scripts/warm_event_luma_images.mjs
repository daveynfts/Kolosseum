/**
 * Cache Conviction side-event Luma covers → Cloudflare R2 (media/{hash}).
 * Rewrites imageUrl in events JSON and optionally PUTs back to R2.
 *
 *   node scripts/warm_event_luma_images.mjs
 *   node scripts/warm_event_luma_images.mjs --put
 *   node scripts/warm_event_luma_images.mjs --from-seed --put
 *   node scripts/warm_event_luma_images.mjs --limit 5
 *
 * Needs R2_* (+ FEED_ADMIN_TOKEN for --put) in .env.local
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

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

const doPut = process.argv.includes('--put')
const fromSeed = process.argv.includes('--from-seed')
const token = env('FEED_ADMIN_TOKEN')
const apiBase = (env('RADAR_API_BASE') || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  if (v == null || v.startsWith('--')) return fallback
  return v
}
const limit = Number(argVal('--limit', '0')) || 0

const MAX_BYTES = 3_000_000
const EVENT_KEY = 'events/conviction-2026/v1.json'

function isR2MediaUrl(u) {
  if (!u || typeof u !== 'string') return false
  if (/lumacdn\.com|lu\.ma|luma\.com|pbs\.twimg\.com/i.test(u)) return false
  return (
    /\/api\/media\?id=/i.test(u) ||
    /r2\.dev\/media\//i.test(u) ||
    /\/media\/[a-f0-9]{16,}/i.test(u)
  )
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 24)
}

function normalizeLumaFetch(url, size = 640) {
  const u = (url || '').trim()
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
    const p = m[1].replace(/^\//, '')
    return (
      `https://images.lumacdn.com/cdn-cgi/image/` +
      `format=auto,fit=cover,dpr=1,background=white,quality=75,` +
      `width=${size},height=${size}/${p}`
    )
  }
  return u
}

function identityKey(url) {
  const m = url.match(
    /images\.lumacdn\.com\/(?:cdn-cgi\/image\/[^/]+\/)?((?:uploads|gallery-images|event-covers)\/[^?#]+)/i,
  )
  if (m) return `luma:${m[1].toLowerCase()}`
  return url
}

function r2() {
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

async function cacheOne(r2cfg, sourceUrl) {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { cachedUrl: sourceUrl, cached: false, error: 'invalid' }
  }
  if (isR2MediaUrl(sourceUrl)) {
    return { cachedUrl: sourceUrl, cached: true, skipped: true }
  }
  const fetchUrl = normalizeLumaFetch(sourceUrl, 640)
  const id = hashUrl(identityKey(fetchUrl))
  const key = `media/${id}`
  try {
    await r2cfg.client.send(
      new HeadObjectCommand({ Bucket: r2cfg.bucket, Key: key }),
    )
    return {
      cachedUrl: mediaPublicUrl(id, r2cfg.publicBase),
      cached: true,
      id,
      existed: true,
    }
  } catch {
    /* missing */
  }
  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; VNKolMap/1.0; +https://github.com/daveynfts/VietNamKOLsRadar)',
        Accept: 'image/*,*/*',
        Referer: 'https://lu.ma/',
      },
      signal: AbortSignal.timeout(15000),
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
      return {
        cachedUrl: sourceUrl,
        cached: false,
        error: `not_image_${contentType}`,
      }
    }
    await r2cfg.client.send(
      new PutObjectCommand({
        Bucket: r2cfg.bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return {
      cachedUrl: mediaPublicUrl(id, r2cfg.publicBase),
      cached: true,
      id,
      bytes: buf.byteLength,
    }
  } catch (e) {
    return {
      cachedUrl: sourceUrl,
      cached: false,
      error: e instanceof Error ? e.message : 'fail',
    }
  }
}

async function loadDataset(r2cfg) {
  if (fromSeed) {
    // dynamic import of seed is TS — read via API seed not available; use R2 or API
    console.log('Note: --from-seed uses GET /api + embedded fallback via admin publish')
  }
  // Prefer R2 direct
  if (r2cfg) {
    try {
      const out = await r2cfg.client.send(
        new GetObjectCommand({ Bucket: r2cfg.bucket, Key: EVENT_KEY }),
      )
      const text = await out.Body?.transformToString()
      if (text) {
        const data = JSON.parse(text)
        if (Array.isArray(data.events)) {
          console.log(`Loaded ${data.events.length} events from R2 ${EVENT_KEY}`)
          return data
        }
      }
    } catch (e) {
      console.warn('R2 get failed:', e instanceof Error ? e.message : e)
    }
  }
  // Fallback API
  try {
    const res = await fetch(`${apiBase}/api/event-side-events?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.events)) {
        console.log(`Loaded ${data.events.length} events from ${apiBase}`)
        return data
      }
    }
    console.warn(`API GET ${res.status}`)
  } catch (e) {
    console.warn('API GET failed:', e instanceof Error ? e.message : e)
  }
  return null
}

async function putDataset(data) {
  if (!token) {
    console.error('Need FEED_ADMIN_TOKEN for --put')
    process.exit(1)
  }
  const res = await fetch(`${apiBase}/api/event-side-events`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...data,
      baseUpdatedAt: data.updatedAt,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('PUT failed', res.status, text.slice(0, 400))
    process.exit(1)
  }
  console.log('PUT ok:', text.slice(0, 300))
}

async function main() {
  const r2cfg = r2()
  if (!r2cfg) {
    console.error('Missing R2_* env (ACCOUNT_ID, ACCESS_KEY_ID, SECRET, BUCKET)')
    process.exit(1)
  }
  console.log('R2 public:', r2cfg.publicBase || '(api proxy)')

  const data = await loadDataset(r2cfg)
  if (!data?.events?.length) {
    console.error('No events to warm. Publish Admin → Events first.')
    process.exit(1)
  }

  const total = data.events.length
  const workCount = limit > 0 ? Math.min(limit, total) : total

  let ok = 0
  let fail = 0
  let skip = 0
  const rebuilt = []

  for (let i = 0; i < total; i++) {
    const ev = data.events[i]
    if (i >= workCount) {
      rebuilt.push(ev)
      continue
    }
    const url = typeof ev.imageUrl === 'string' ? ev.imageUrl.trim() : ''
    if (!url) {
      rebuilt.push(ev)
      continue
    }
    process.stdout.write(`[${i + 1}/${workCount}] ${ev.id || ev.title} … `)
    const r = await cacheOne(r2cfg, url)
    if (r.skipped || r.existed) {
      skip++
      console.log(r.existed ? `hit ${r.id}` : 'already R2')
      rebuilt.push({ ...ev, imageUrl: r.cachedUrl || url })
    } else if (r.cached) {
      ok++
      console.log(`cached ${r.id} (${r.bytes || '?'} B)`)
      rebuilt.push({ ...ev, imageUrl: r.cachedUrl })
    } else {
      fail++
      console.log(`FAIL ${r.error}`)
      rebuilt.push(ev)
    }
  }

  console.log(`\nDone: cached=${ok} skip/hit=${skip} fail=${fail}`)

  const out = {
    ...data,
    events: rebuilt,
    updatedAt: new Date().toISOString(),
    note: [data.note, 'luma covers on R2'].filter(Boolean).join(' · '),
  }

  // Always write local snapshot for debug
  const snap = path.join(ROOT, 'data/internal/events-conviction-warmed.json')
  fs.mkdirSync(path.dirname(snap), { recursive: true })
  fs.writeFileSync(snap, JSON.stringify(out, null, 2))
  console.log('Wrote', snap)

  if (doPut) {
    // Direct R2 put (avoids serverless time budget on API re-cache)
    await r2cfg.client.send(
      new PutObjectCommand({
        Bucket: r2cfg.bucket,
        Key: EVENT_KEY,
        Body: JSON.stringify(out),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-store',
      }),
    )
    console.log(`Wrote R2 ${EVENT_KEY}`)
  } else {
    console.log('Dry run — re-run with --put to publish imageUrl → R2 media')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
