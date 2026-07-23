/**
 * Merge a batch of original-post status URLs into SCEX tracking seed.
 * Then: node scripts/hydrate_scex_media.mjs --via-api --put
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

const BATCH = [
  { handle: 'vangemxin1', displayName: 'vangemxin1', followers: 2224, goc: 1, reply: 0, views: 1393, tone: 'Trung lập', links: 'https://x.com/vangemxin1/status/2072604652722630891' },
  { handle: 'tranninh9', displayName: 'TranNinh9', followers: 438, goc: 1, reply: 0, views: 1263, tone: 'Bullish', links: 'https://x.com/TranNinh9/status/2074466305353408841' },
  { handle: 'crypto181199', displayName: 'Crypto181199', followers: 8169, goc: 1, reply: 0, views: 1164, tone: 'Trung lập', links: 'https://x.com/Crypto181199/status/2074807677331587391' },
  { handle: 'v_3394', displayName: 'v_3394', followers: 9950, goc: 1, reply: 0, views: 1154, tone: 'Trung lập', links: 'https://x.com/v_3394/status/2073352996805812314' },
  { handle: 'ghostxwriterx', displayName: 'GhostxWriterx', followers: 5404, goc: 1, reply: 0, views: 1040, tone: 'Hỗn hợp', links: 'https://x.com/GhostxWriterx/status/2072146301345784074' },
  { handle: 'maybach_eth', displayName: 'maybach_eth', followers: 19800, goc: 1, reply: 0, views: 1027, tone: 'Hỗn hợp', links: 'https://x.com/maybach_eth/status/2074683102811861021' },
  { handle: 'charlotte951231', displayName: 'Charlotte951231', followers: 2625, goc: 1, reply: 0, views: 993, tone: 'Bullish', links: 'https://x.com/Charlotte951231/status/2075116644394029555' },
  { handle: 'sushi1426', displayName: 'sushi1426', followers: 6373, goc: 1, reply: 0, views: 937, tone: 'Trung lập', links: 'https://x.com/sushi1426/status/2073426948823683121' },
  { handle: 'tuongvi_vn', displayName: 'TuongVi_VN', followers: 5198, goc: 1, reply: 0, views: 895, tone: 'Bullish', links: 'https://x.com/TuongVi_VN/status/2071942971591934410' },
  { handle: 'tesnguyeneth', displayName: 'tesnguyeneth', followers: 9402, goc: 1, reply: 0, views: 873, tone: 'Bullish', links: 'https://x.com/tesnguyeneth/status/2072655783700168889' },
  { handle: 'mr_mmon', displayName: 'mr_mmon', followers: 2914, goc: 1, reply: 0, views: 855, tone: 'Hỗn hợp', links: 'https://x.com/mr_mmon/status/2073990513179709634' },
  { handle: 'cuong2591442657', displayName: 'Cuong2591442657', followers: 3503, goc: 1, reply: 0, views: 788, tone: 'Bullish', links: 'https://x.com/Cuong2591442657/status/2072137706407350468' },
  { handle: '0xpain__', displayName: '0xPain', followers: 7235, goc: 1, reply: 0, views: 690, tone: 'Bullish', links: 'https://x.com/0xPain__/status/2071959652829708353' },
  { handle: 'thinhcrt', displayName: 'ThinhCrt', followers: 3082, goc: 1, reply: 0, views: 674, tone: 'Trung lập', links: 'https://x.com/ThinhCrt/status/2073798975929631134' },
  { handle: 'trungdino90', displayName: 'Trungdino90', followers: 9558, goc: 1, reply: 0, views: 662, tone: 'Bullish', links: 'https://x.com/Trungdino90/status/2072227547824459961' },
  { handle: 'dntthi', displayName: 'DntThi', followers: 7201, goc: 1, reply: 0, views: 582, tone: 'Bullish', links: 'https://x.com/DntThi/status/2075221511494119671' },
  { handle: 'ptginking', displayName: 'PTGinKing', followers: 17800, goc: 1, reply: 0, views: 564, tone: 'Trung lập', links: 'https://x.com/PTGinKing/status/2078742025227436536' },
  { handle: 'realfrontierx', displayName: 'RealFrontierX', followers: 3026, goc: 1, reply: 0, views: 552, tone: 'Trung lập', links: 'https://x.com/RealFrontierX/status/2072261079405568223' },
  { handle: 'cavana_eth', displayName: 'Cavana_eth', followers: 5087, goc: 1, reply: 0, views: 509, tone: 'Trung lập', links: 'https://x.com/Cavana_eth/status/2072912336890057210' },
  { handle: 'thangha19931991', displayName: 'thangha19931991', followers: 7731, goc: 1, reply: 0, views: 410, tone: 'Trung lập', links: 'https://x.com/thangha19931991/status/2073045804710047832' },
  { handle: 'vietnamvba', displayName: 'VietnamVBA', followers: 1240, goc: 1, reply: 0, views: 332, tone: 'Trung lập', links: 'https://x.com/VietnamVBA/status/2075818065187774734' },
  { handle: 'gynis_tao', displayName: 'Noat', followers: 7568, goc: 1, reply: 0, views: 327, tone: 'Bullish', links: 'https://x.com/Gynis_TAO/status/2072288704979464552' },
  { handle: 'trong_ga29814', displayName: 'trong_ga29814', followers: 3126, goc: 1, reply: 0, views: 274, tone: 'Hỗn hợp', links: 'https://x.com/trong_ga29814/status/2072238540365451348' },
  { handle: 'bem1102', displayName: 'bem1102', followers: 1093, goc: 1, reply: 0, views: 272, tone: 'Bullish', links: 'https://x.com/bem1102/status/2072326886840250611' },
  { handle: 'cocoteamvnn', displayName: 'COCOteamvnn', followers: 1203, goc: 1, reply: 0, views: 243, tone: 'Bullish', links: 'https://x.com/COCOteamvnn/status/2072239163202846951' },
  { handle: 'deekay_btc', displayName: 'deekay_btc', followers: 7176, goc: 1, reply: 0, views: 243, tone: 'Bullish', links: 'https://x.com/deekay_btc/status/2072229508107907434' },
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
  `Batch posts +${added} (vangemxin1, TranNinh9, maybach, PTGinKing, …).`,
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
    { added, byHandle: byHandleAdded, totalPosts: posts.length, totalActors: actors.length },
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
