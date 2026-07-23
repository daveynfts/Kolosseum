/**
 * Merge a batch of original-post status URLs into SCEX tracking seed + optional PUT.
 * Then run: node scripts/hydrate_scex_media.mjs --via-api --put
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

/** Latest export batch */
const BATCH = [
  {
    handle: 'khiembnb',
    displayName: 'KhiemBNB',
    followers: 5197,
    goc: 3,
    reply: 0,
    views: 1160,
    tone: 'Hỗn hợp',
    links: `
https://x.com/KhiemBNB/status/2072520002138484947
https://x.com/KhiemBNB/status/2073396777374675203
https://x.com/KhiemBNB/status/2073396780906201097
`,
  },
  {
    handle: 'dinhthang97',
    displayName: 'dinhthang97',
    followers: 37700,
    goc: 2,
    reply: 18,
    views: 4180,
    tone: 'Trung lập',
    links: `
https://x.com/dinhthang97/status/2079116595818013109
https://x.com/dinhthang97/status/2079555518297686171
`,
  },
  {
    handle: 'blockmedia_vn',
    displayName: 'Blockmedia_vn',
    followers: 30300,
    goc: 2,
    reply: 4,
    views: 3945,
    tone: 'Hỗn hợp',
    links: `
https://x.com/Blockmedia_vn/status/2072141094297755948
https://x.com/Blockmedia_vn/status/2072583803785117944
`,
  },
  {
    handle: 'kaibgr',
    displayName: 'KaiBGR',
    followers: 18400,
    goc: 2,
    reply: 4,
    views: 2806,
    tone: 'Bullish',
    links: `
https://x.com/KaiBGR/status/2072296664237326359
https://x.com/KaiBGR/status/2073638110504894879
`,
  },
  {
    handle: 'lensmoso',
    displayName: 'Lens',
    followers: 32000,
    goc: 2,
    reply: 4,
    views: 1606,
    tone: 'Hỗn hợp',
    links: `
https://x.com/LensMoso/status/2072270496658534625
https://x.com/LensMoso/status/2079121884960940037
`,
  },
  {
    handle: '0xcut555',
    displayName: '0xCut555',
    followers: 25600,
    goc: 2,
    reply: 3,
    views: 3428,
    tone: 'Hỗn hợp',
    links: `
https://x.com/0xCut555/status/2071943222457499719
https://x.com/0xCut555/status/2078366429703971294
`,
  },
  {
    handle: 'qwarm1990',
    displayName: 'QWarm',
    followers: 28300,
    goc: 2,
    reply: 3,
    views: 2031,
    tone: 'Bullish',
    links: `
https://x.com/QWarm1990/status/2072191217132285965
https://x.com/QWarm1990/status/2077725183150788627
`,
  },
  {
    handle: 'aiadopthq',
    displayName: 'AIAdoptHQ',
    followers: 26800,
    goc: 2,
    reply: 0,
    views: 20979,
    tone: 'Bullish',
    links: `
https://x.com/AIAdoptHQ/status/2071882101092429864
https://x.com/AIAdoptHQ/status/2072145610061591004
`,
  },
  {
    handle: 'kemphuyen',
    displayName: 'Kemphuyen',
    followers: 22300,
    goc: 2,
    reply: 0,
    views: 20873,
    tone: 'Hỗn hợp',
    links: `
https://x.com/Kemphuyen/status/2072607238527816134
https://x.com/Kemphuyen/status/2074827392343007362
`,
  },
  {
    handle: 'quilix',
    displayName: 'quilix',
    followers: 21400,
    goc: 2,
    reply: 0,
    views: 19028,
    tone: 'Hỗn hợp',
    links: `
https://x.com/quilix/status/2072233496119329062
https://x.com/quilix/status/2072965427052118095
`,
  },
  {
    handle: 'quanm2831',
    displayName: 'quanm2831',
    followers: 12600,
    goc: 2,
    reply: 0,
    views: 17596,
    tone: 'Bullish',
    links: `
https://x.com/quanm2831/status/2071949178893402619
https://x.com/quanm2831/status/2071949187604959412
`,
  },
  {
    handle: 'sera_nie',
    displayName: 'sera_nie',
    followers: 3610,
    goc: 2,
    reply: 0,
    views: 15449,
    tone: 'Hỗn hợp',
    links: `
https://x.com/sera_nie/status/2072115468706443307
https://x.com/sera_nie/status/2072538170386981057
`,
  },
]

const seedPaths = [
  path.join(ROOT, 'src/data/internal/scex-tracking.json'),
  path.join(ROOT, 'data/internal/scex-tracking.json'),
]

const dataset = JSON.parse(fs.readFileSync(seedPaths[0], 'utf8'))
const posts = Array.isArray(dataset.posts) ? [...dataset.posts] : []
const actors = Array.isArray(dataset.actors) ? [...dataset.actors] : []

const existingIds = new Set()
for (const p of posts) {
  const m = String(p.url || p.id || '').match(/(\d{5,25})/g)
  if (m) m.forEach((id) => existingIds.add(id))
  const id = String(p.id || '').replace(/^p_/, '')
  if (/^\d{5,25}$/.test(id)) existingIds.add(id)
}

let added = 0
const byHandleAdded = {}

for (const row of BATCH) {
  const h = row.handle.toLowerCase()
  const sent = mapTone(row.tone)
  const totalVol = row.goc + row.reply

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
    actor.displayName = row.displayName || actor.displayName
    actor.notes = `Gốc ${row.goc} · Reply ${row.reply} · Views ${row.views} · Tone: ${row.tone}`
    actor.tags = [
      `goc:${row.goc}`,
      `reply:${row.reply}`,
      row.tone === 'Hỗn hợp' ? 'mixed' : sent,
    ].join(',')
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
  String(dataset.note || '').replace(/\s*· Batch posts[^.]*\.?/gi, ''),
  `Batch posts +${added} (KhiemBNB, dinhthang97, Blockmedia, KaiBGR, Lens, …).`,
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
