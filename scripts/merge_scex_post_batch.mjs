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
  { handle: 'tdcryptovn', displayName: 'tdcryptovn', followers: 16800, goc: 1, reply: 2, views: 1972, tone: 'Bullish', links: 'https://x.com/tdcryptovn/status/2073386055458500619' },
  { handle: 'huevatoi', displayName: 'HuevaToi', followers: 19900, goc: 1, reply: 2, views: 1698, tone: 'Bullish', links: 'https://x.com/HuevaToi/status/2078702720379466131' },
  { handle: 'iamnxa', displayName: 'iamnxa', followers: 17000, goc: 1, reply: 1, views: 22912, tone: 'Hỗn hợp', links: 'https://x.com/iamnxa/status/2073208921318396327' },
  { handle: 'thienthien1305', displayName: 'Thienthien1305', followers: 52400, goc: 1, reply: 1, views: 12008, tone: 'Bullish', links: 'https://x.com/Thienthien1305/status/2072247319324405861' },
  { handle: 'vinhdtrai', displayName: 'vinhdtrai', followers: 19100, goc: 1, reply: 1, views: 4496, tone: 'Hỗn hợp', links: 'https://x.com/vinhdtrai/status/2072858182146539576' },
  { handle: 'father_monkey92', displayName: 'Father_monkey92', followers: 16500, goc: 1, reply: 1, views: 2142, tone: 'Bullish', links: 'https://x.com/Father_monkey92/status/2072636952474759278' },
  { handle: 'pigrichh', displayName: 'Pig Pig', followers: 28400, goc: 1, reply: 1, views: 1641, tone: 'Bullish', links: 'https://x.com/pigrichh/status/2072554006246051847' },
  { handle: 'kaisenview', displayName: 'Kaisenview', followers: 18000, goc: 1, reply: 1, views: 1583, tone: 'Hỗn hợp', links: 'https://x.com/Kaisenview/status/2072608690637803775' },
  { handle: '0xkyliekim', displayName: '0xkyliekim', followers: 8813, goc: 1, reply: 1, views: 1491, tone: 'Bullish', links: 'https://x.com/0xkyliekim/status/2073415354584305935' },
  { handle: 'vanhuuxvietnam', displayName: 'Vanhuuxvietnam', followers: 982, goc: 1, reply: 1, views: 1138, tone: 'Bullish', links: 'https://x.com/Vanhuuxvietnam/status/2074008665963806866' },
  { handle: 'mieweb3', displayName: 'MieWeb3', followers: 23800, goc: 1, reply: 1, views: 996, tone: 'Bullish', links: 'https://x.com/MieWeb3/status/2072946227671675273' },
  { handle: 'kenshinc', displayName: 'KenshinC', followers: 5739, goc: 1, reply: 1, views: 707, tone: 'Trung lập', links: 'https://x.com/KenshinC/status/2072166856849576187' },
  { handle: 'gf_capital', displayName: 'GF Capital', followers: 146000, goc: 1, reply: 0, views: 11094, tone: 'Bullish', links: 'https://x.com/GF_Capital/status/2071962351012868261' },
  { handle: 'bicantho', displayName: 'BiCanTho', followers: 65099, goc: 1, reply: 0, views: 8644, tone: 'Bullish', links: 'https://x.com/BiCanTho/status/2072147057662656998' },
  { handle: 'thanhcryptobnb', displayName: 'ThanhCryptoBnb', followers: 55800, goc: 1, reply: 0, views: 6593, tone: 'Bullish', links: 'https://x.com/ThanhCryptoBnb/status/2072162900656197915' },
  { handle: 'nickypham_hc', displayName: 'NickyPham_HC', followers: 335200, goc: 1, reply: 0, views: 5941, tone: 'Bullish', links: 'https://x.com/NickyPham_HC/status/2071992091304153281' },
  { handle: 'vanmei', displayName: 'Vanmei', followers: 7546, goc: 1, reply: 0, views: 5793, tone: 'Trung lập', links: 'https://x.com/Vanmei/status/2072126570089889976' },
  { handle: 'chanhdoro', displayName: 'chanhdoro', followers: 17500, goc: 1, reply: 0, views: 5319, tone: 'Hỗn hợp', links: 'https://x.com/chanhdoro/status/2072716853865255134' },
  { handle: 'tradealot_', displayName: 'TradeALot_', followers: 4263, goc: 1, reply: 0, views: 5102, tone: 'Bullish', links: 'https://x.com/TradeALot_/status/2071869408319013232' },
  { handle: 'tran_today', displayName: 'Tran_Today', followers: 14900, goc: 1, reply: 0, views: 4430, tone: 'Bullish', links: 'https://x.com/Tran_Today/status/2072867691598344231' },
  { handle: 'sangbtcethxau', displayName: 'Sang.BTC', followers: 18500, goc: 1, reply: 0, views: 4421, tone: 'Bearish', links: 'https://x.com/SangBTCethXAU/status/2071987860664889738' },
  { handle: 'trimaims', displayName: 'TriMaiMS', followers: 83900, goc: 1, reply: 0, views: 4386, tone: 'Hỗn hợp', links: 'https://x.com/TriMaiMS/status/2072691229746425999' },
  { handle: 'dohhanx', displayName: 'dohhanx', followers: 1477, goc: 1, reply: 0, views: 2769, tone: 'Bullish', links: 'https://x.com/dohhanx/status/2072561936680751157' },
  { handle: 'mobx134', displayName: 'MobX134', followers: 12900, goc: 1, reply: 0, views: 2619, tone: 'Hỗn hợp', links: 'https://x.com/MobX134/status/2071988247014920427' },
  { handle: 'hongmyresearch', displayName: 'hongmyresearch', followers: 4515, goc: 1, reply: 0, views: 2283, tone: 'Bullish', links: 'https://x.com/hongmyresearch/status/2072231815461720463' },
  { handle: 'seven_nguyen666', displayName: 'Seven_Nguyen666', followers: 24900, goc: 1, reply: 0, views: 2090, tone: 'Trung lập', links: 'https://x.com/Seven_Nguyen666/status/2072608718219526182' },
  { handle: 'rightrh', displayName: 'RightRH', followers: 7316, goc: 1, reply: 0, views: 1948, tone: 'Bullish', links: 'https://x.com/RightRH/status/2072178184628629674' },
  { handle: 'kyanh6789', displayName: 'KyAnh6789', followers: 3031, goc: 1, reply: 0, views: 1838, tone: 'Bullish', links: 'https://x.com/KyAnh6789/status/2073672495316730363' },
  { handle: 'lokilaw_nld', displayName: 'Lokilaw_NLD', followers: 5662, goc: 1, reply: 0, views: 1797, tone: 'Bullish', links: 'https://x.com/Lokilaw_NLD/status/2072242680193847786' },
  { handle: 'luongson94', displayName: 'Luongson94', followers: 21200, goc: 1, reply: 0, views: 1663, tone: 'Bullish', links: 'https://x.com/Luongson94/status/2072185357098193303' },
  { handle: 'ritaxfinance', displayName: 'RitaXFinance', followers: 15400, goc: 1, reply: 0, views: 1647, tone: 'Bullish', links: 'https://x.com/RitaXFinance/status/2072531253249626517' },
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
  `Batch posts +${added} (tdcrypto, NickyPham, BiCanTho, GF_Capital, …).`,
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
