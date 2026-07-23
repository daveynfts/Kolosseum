/**
 * Merge a batch of original-post status URLs into SCEX tracking seed + optional PUT.
 * Does NOT hydrate media (run hydrate_scex_media.mjs after).
 *
 *   node scripts/merge_scex_post_batch.mjs
 *   node scripts/merge_scex_post_batch.mjs --put
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const doPut = process.argv.includes('--put')

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

function snowflakeToIso(idStr) {
  try {
    const ms = Number((BigInt(idStr) >> 22n) + 1288834974657n)
    return new Date(ms).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function parseStatusUrls(blob) {
  const re =
    /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d{5,25})/gi
  const out = []
  const seen = new Set()
  let m
  while ((m = re.exec(String(blob)))) {
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      handle: m[1].toLowerCase(),
      statusId: id,
      url: `https://x.com/${m[1]}/status/${id}`,
    })
  }
  return out
}

function mapTone(tone) {
  const t = String(tone || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (t.includes('bullish') || t.includes('tich cuc')) return 'bullish'
  if (t.includes('bearish') || t.includes('tieu cuc')) return 'bearish'
  return 'neutral'
}

/** Batch from user export */
const BATCH = [
  {
    handle: 'kt_btc',
    displayName: 'KT',
    followers: 44100,
    goc: 4,
    reply: 11,
    views: 53387,
    tone: 'Hỗn hợp',
    links: `
https://x.com/KT_BTC/status/2072605824141467753
https://x.com/KT_BTC/status/2073969461917548783
https://x.com/KT_BTC/status/2077708403267502437
https://x.com/KT_BTC/status/2079039587067064705
`,
  },
  {
    handle: 'shuigvn',
    displayName: 'shuigvn',
    followers: 18700,
    goc: 4,
    reply: 2,
    views: 144206,
    tone: 'Hỗn hợp',
    links: `
https://x.com/shuigvn/status/2072235957802488276
https://x.com/shuigvn/status/2072601440502350178
https://x.com/shuigvn/status/2073565019380289643
https://x.com/shuigvn/status/2075110835660468636
`,
  },
  {
    handle: 'sucvat65111',
    displayName: 'SucVat65111',
    followers: 7028,
    goc: 4,
    reply: 0,
    views: 36154,
    tone: 'Hỗn hợp',
    links: `
https://x.com/SucVat65111/status/2072126480528908632
https://x.com/SucVat65111/status/2072220315082703032
https://x.com/SucVat65111/status/2072310411278655514
https://x.com/SucVat65111/status/2072521259020374178
`,
  },
  {
    handle: 'bachkhoabnb',
    displayName: 'bachkhoabnb',
    followers: 47200,
    goc: 3,
    reply: 37,
    views: 16994,
    tone: 'Hỗn hợp',
    links: `
https://x.com/bachkhoabnb/status/2072159359023677844
https://x.com/bachkhoabnb/status/2078303538137149895
https://x.com/bachkhoabnb/status/2079059146385805449
`,
  },
  {
    handle: 'kiengold',
    displayName: 'KienGold',
    followers: 9005,
    goc: 3,
    reply: 0,
    views: 13759,
    tone: 'Hỗn hợp',
    links: `
https://x.com/KienGold/status/2072187013504365005
https://x.com/KienGold/status/2072500850464043059
https://x.com/KienGold/status/2074425414546772200
`,
  },
  {
    handle: 'kieuphong78',
    displayName: 'KieuPhong78',
    followers: 8249,
    goc: 3,
    reply: 0,
    views: 5655,
    tone: 'Hỗn hợp',
    links: `
https://x.com/KieuPhong78/status/2072878754830188596
https://x.com/KieuPhong78/status/2073433775615397932
https://x.com/KieuPhong78/status/2074701114667364844
`,
  },
  {
    handle: 'database52hz',
    displayName: 'Database52Hz',
    followers: 17500,
    goc: 3,
    reply: 0,
    views: 5600,
    tone: 'Hỗn hợp',
    links: `
https://x.com/Database52Hz/status/2072315469441503611
https://x.com/Database52Hz/status/2072523300094513235
https://x.com/Database52Hz/status/2073302887179112885
`,
  },
  {
    handle: 'mrtrinhcrypto',
    displayName: 'mrtrinhcrypto',
    followers: 2455,
    goc: 3,
    reply: 0,
    views: 3640,
    tone: 'Bullish',
    links: `
https://x.com/mrtrinhcrypto/status/2072188076722405429
https://x.com/mrtrinhcrypto/status/2072333524061790301
https://x.com/mrtrinhcrypto/status/2072708527760498792
`,
  },
  {
    handle: 'dungtudau',
    displayName: 'Dungtudau',
    followers: 7727,
    goc: 3,
    reply: 0,
    views: 2771,
    tone: 'Bullish',
    links: `
https://x.com/Dungtudau/status/2072231333167034648
https://x.com/Dungtudau/status/2072564061028659289
https://x.com/Dungtudau/status/2072852991212945829
`,
  },
  {
    handle: 'verathai11',
    displayName: 'verathai11',
    followers: 12500,
    goc: 3,
    reply: 0,
    views: 1948,
    tone: 'Hỗn hợp',
    links: `
https://x.com/verathai11/status/2072178054437515493
https://x.com/verathai11/status/2072656404830367798
https://x.com/verathai11/status/2073995952269205941
`,
  },
]

const seedPaths = [
  path.join(ROOT, 'src/data/internal/scex-tracking.json'),
  path.join(ROOT, 'data/internal/scex-tracking.json'),
]

const dataset = JSON.parse(fs.readFileSync(seedPaths[0], 'utf8'))
const posts = Array.isArray(dataset.posts) ? dataset.posts : []
const actors = Array.isArray(dataset.actors) ? dataset.actors : []

const existingIds = new Set()
for (const p of posts) {
  const m = String(p.url || p.id || '').match(/(\d{5,25})/)
  if (m) existingIds.add(m[1])
  const id = String(p.id || '').replace(/^p_/, '')
  if (/^\d{5,25}$/.test(id)) existingIds.add(id)
}

let added = 0
const byHandleAdded = {}

for (const row of BATCH) {
  const h = row.handle.toLowerCase()
  const sent = mapTone(row.tone)
  const totalVol = row.goc + row.reply

  // Upsert actor metrics
  let actor = actors.find((a) => a.handle.toLowerCase() === h)
  if (!actor) {
    actor = {
      id: `a_${h}`,
      handle: h,
      displayName: row.displayName,
      kind: 'kol',
      followers: row.followers,
      reach7d: row.views,
      postsVolume: totalVol,
      qualityScore: 50,
      sentiment: sent,
      isWhitelisted: true,
    }
    actors.push(actor)
  } else {
    actor.followers = row.followers
    actor.reach7d = row.views
    actor.postsVolume = totalVol
    actor.sentiment = sent
    actor.notes = `Gốc ${row.goc} · Reply ${row.reply} · Views ${row.views} · Tone: ${row.tone}`
    actor.tags = [`goc:${row.goc}`, `reply:${row.reply}`, row.tone === 'Hỗn hợp' ? 'mixed' : sent].join(
      ',',
    )
  }

  const links = parseStatusUrls(row.links)
  byHandleAdded[h] = 0
  for (const L of links) {
    if (existingIds.has(L.statusId)) continue
    existingIds.add(L.statusId)
    posts.push({
      id: `p_${L.statusId}`,
      handle: L.handle,
      url: L.url,
      text: `@${L.handle} · mention SCEX (export gốc) · tone ${row.tone}`,
      postedAt: snowflakeToIso(L.statusId),
      sentiment: sent,
      hidden: false,
      notes: `export batch · ${row.tone}`,
    })
    added++
    byHandleAdded[h]++
  }

  // lastPostAt from newest post for handle
  const handlePosts = posts.filter((p) => p.handle === h)
  if (handlePosts.length) {
    handlePosts.sort(
      (a, b) => new Date(b.postedAt) - new Date(a.postedAt),
    )
    actor.lastPostAt = handlePosts[0].postedAt
  }
}

posts.sort(
  (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
)
dataset.posts = posts
dataset.actors = actors
dataset.updatedAt = new Date().toISOString()
dataset.note = [
  String(dataset.note || '').replace(/\s*· Batch posts[^.]*\.?/i, ''),
  `Batch posts +${added} (KT, shuigvn, SucVat, bachkhoabnb, KienGold, …).`,
]
  .filter(Boolean)
  .join(' ')

const json = JSON.stringify(dataset, null, 2) + '\n'
for (const p of seedPaths) {
  fs.writeFileSync(p, json, 'utf8')
  console.log('wrote', p)
}

console.log(
  JSON.stringify(
    {
      added,
      byHandle: byHandleAdded,
      totalPosts: posts.length,
      totalActors: actors.length,
    },
    null,
    2,
  ),
)

if (doPut) {
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }
  const putRes = await fetch(`${base}/api/scex-tracking`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dataset),
  })
  console.log('PUT', putRes.status, (await putRes.text()).slice(0, 200))
  if (!putRes.ok) process.exit(1)
}
