/**
 * Cache SCEX livefeed tweet media to R2 (same pipeline as map feed /api/x-status).
 * Writes media[] + engagement onto scex-tracking seed, optional PUT R2 tracking JSON.
 *
 *   node scripts/hydrate_scex_media.mjs
 *   node scripts/hydrate_scex_media.mjs --put
 *   node scripts/hydrate_scex_media.mjs --force   # re-fetch even if media[] already set
 *   node scripts/hydrate_scex_media.mjs --limit 10
 *
 * Uses GET /api/x-status?url=… which downloads images → media/{hash} on R2.
 * Public page then serves only stored URLs — no live X calls in the browser.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)
const doPut = process.argv.includes('--put')
const force = process.argv.includes('--force')

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

function loadDataset() {
  return JSON.parse(fs.readFileSync(seedPaths[0], 'utf8'))
}

function isR2MediaUrl(u) {
  if (!u || typeof u !== 'string') return false
  return (
    u.includes('/api/media') ||
    u.includes('/media/') ||
    u.includes('r2.dev/media') ||
    /media\/[a-f0-9]{8,}/i.test(u)
  )
}

function pickMedia(post) {
  const cached = Array.isArray(post.mediaCached)
    ? post.mediaCached.filter(Boolean)
    : []
  const all = Array.isArray(post.media) ? post.media.filter(Boolean) : []
  // Prefer R2-backed URLs from x-status cache
  const r2 = [...cached, ...all].filter(isR2MediaUrl)
  if (r2.length) return Array.from(new Set(r2)).slice(0, 4)
  return Array.from(new Set(all)).slice(0, 4)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchStatus(url) {
  const api = `${base}/api/x-status?url=${encodeURIComponent(url)}`
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(api, { headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.post) {
    return {
      ok: false,
      status: res.status,
      error: body.message || body.error || `HTTP ${res.status}`,
    }
  }
  return {
    ok: true,
    post: body.post,
    cache: body.cache,
  }
}

async function main() {
  const dataset = loadDataset()
  const posts = Array.isArray(dataset.posts) ? dataset.posts : []
  let targets = posts.filter((p) => p && p.url && !p.hidden)
  if (!force) {
    targets = targets.filter(
      (p) => !Array.isArray(p.media) || p.media.length === 0 || !p.media.some(isR2MediaUrl),
    )
  }
  if (limit > 0) targets = targets.slice(0, limit)

  console.log(
    JSON.stringify(
      {
        base,
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
        const r = await fetchStatus(p.url)
        if (!r.ok) {
          fail++
          console.log('FAIL', r.status, r.error)
          await sleep(400)
          continue
        }
        const media = pickMedia(r.post)
        const cur = byId.get(p.id) || p
        cur.media = media
        if (r.post.likes != null) cur.likes = Number(r.post.likes) || 0
        if (r.post.reposts != null) cur.reposts = Number(r.post.reposts) || 0
        if (r.post.replies != null) cur.replies = Number(r.post.replies) || 0
        if (r.post.views != null) cur.views = Number(r.post.views) || 0
        // Prefer fuller live text when summary was short
        if (
          r.post.text &&
          String(r.post.text).trim().length >
            String(cur.text || '').trim().length + 8
        ) {
          cur.text = String(r.post.text).trim()
        }
        if (r.post.createdAt) {
          const t = new Date(r.post.createdAt).getTime()
          if (!Number.isNaN(t)) cur.postedAt = new Date(t).toISOString()
        }
        const noteBits = [cur.notes || '', 'media→R2 via x-status']
          .filter(Boolean)
          .join(' · ')
        cur.notes = noteBits
        byId.set(p.id, cur)
        ok++
        if (media.length) withMedia++
        console.log(
          'ok',
          `media=${media.length}`,
          media[0] ? (isR2MediaUrl(media[0]) ? 'R2' : 'remote') : 'none',
          r.cache
            ? `cached=${r.cache.imagesCached}/${r.cache.imagesTotal}`
            : '',
        )
      } catch (e) {
        fail++
        console.log('ERR', e instanceof Error ? e.message : e)
      }
      await sleep(350)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  dataset.posts = posts.map((p) => byId.get(p.id) || p)
  dataset.updatedAt = new Date().toISOString()
  dataset.note = [
    String(dataset.note || '').replace(/\s*·\s*Media hydrated[^.]*\.?/i, ''),
    `Media hydrated to R2 (${withMedia}/${posts.length} posts with images, ${ok} fetched).`,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  const json = JSON.stringify(dataset, null, 2) + '\n'
  for (const p of seedPaths) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, json, 'utf8')
    console.log('wrote', p)
  }

  console.log(
    JSON.stringify(
      { ok, fail, withMedia, posts: posts.length, r2MediaPosts: posts.filter((p) => (p.media || []).some(isR2MediaUrl)).length },
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
      const mediaN = (got.posts || []).filter((p) => p.media?.length).length
      console.log('GET verify', {
        status: getRes.status,
        posts: got.posts?.length,
        withMedia: mediaN,
      })
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
