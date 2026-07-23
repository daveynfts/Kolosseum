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
  { handle: 'tungthuocno', displayName: 'Tungthuocno', followers: 1769, goc: 1, reply: 0, views: 238, tone: 'Bullish', links: 'https://x.com/Tungthuocno/status/2072274516282409059' },
  { handle: 'anhvu193', displayName: 'anhvu193', followers: 4344, goc: 1, reply: 0, views: 215, tone: 'Bullish', links: 'https://x.com/anhvu193/status/2072571086374580232' },
  { handle: 'vietnambackcom', displayName: 'Vietnambackcom', followers: 92, goc: 1, reply: 0, views: 210, tone: 'Bullish', links: 'https://x.com/Vietnambackcom/status/2073442040281727306' },
  { handle: 'anhdii72', displayName: 'Anhdii72', followers: 2979, goc: 1, reply: 0, views: 209, tone: 'Bullish', links: 'https://x.com/Anhdii72/status/2073646506524225537' },
  { handle: 'jasonblockchain', displayName: 'jasonblockchain', followers: 5518, goc: 1, reply: 0, views: 209, tone: 'Trung lập', links: 'https://x.com/jasonblockchain/status/2078429303486959646' },
  { handle: 'phwquynh01', displayName: 'PhwQuynh01', followers: 1730, goc: 1, reply: 0, views: 205, tone: 'Trung lập', links: 'https://x.com/PhwQuynh01/status/2072614052086624422' },
  { handle: 'hungtinh1993', displayName: 'HungTinh1993', followers: 9057, goc: 1, reply: 0, views: 203, tone: 'Bullish', links: 'https://x.com/HungTinh1993/status/2072569716351385716' },
  { handle: 'alancipher43', displayName: 'alancipher43', followers: 1646, goc: 1, reply: 0, views: 191, tone: 'Trung lập', links: 'https://x.com/alancipher43/status/2075938003663691891' },
  { handle: 'tannnnnnn2022', displayName: 'Tannnnnnn2022', followers: 12400, goc: 1, reply: 0, views: 172, tone: 'Trung lập', links: 'https://x.com/Tannnnnnn2022/status/2072638917212303793' },
  { handle: 'digittrad2407', displayName: 'DigitTrad2407', followers: 17100, goc: 1, reply: 0, views: 151, tone: 'Trung lập', links: 'https://x.com/DigitTrad2407/status/2072513387670688149' },
  { handle: 'daveynftsai', displayName: 'DaveyNFTsAI', followers: 2500, goc: 1, reply: 0, views: 148, tone: 'Bullish', links: 'https://x.com/DaveyNFTsAI/status/2072250811556749710' },
  { handle: 'nick_htlc', displayName: 'Nick_HTLC', followers: 4400, goc: 1, reply: 0, views: 135, tone: 'Trung lập', links: 'https://x.com/Nick_HTLC/status/2072504366532362529' },
  { handle: 'luugian95257476', displayName: 'LuuGian95257476', followers: 3056, goc: 1, reply: 0, views: 123, tone: 'Bullish', links: 'https://x.com/LuuGian95257476/status/2072857465012859257' },
  { handle: 'vninvestblogger', displayName: 'Brian Truong', followers: 4332, goc: 1, reply: 0, views: 116, tone: 'Bullish', links: 'https://x.com/VnInvestBlogger/status/2072664551439634649' },
  { handle: 'valuespreading', displayName: 'valuespreading', followers: 1706, goc: 1, reply: 0, views: 115, tone: 'Bullish', links: 'https://x.com/valuespreading/status/2072297532676558851' },
  { handle: 'datmindchart', displayName: 'datmindchart', followers: 1525, goc: 1, reply: 0, views: 113, tone: 'Bullish', links: 'https://x.com/datmindchart/status/2072647126849606002' },
  { handle: 'wendyr9_', displayName: 'wendyr9_', followers: 6018, goc: 1, reply: 0, views: 111, tone: 'Bullish', links: 'https://x.com/wendyr9_/status/2072270237924479113' },
  { handle: 'bigknivess', displayName: 'Bigknives', followers: 1302, goc: 1, reply: 0, views: 99, tone: 'Bullish', links: 'https://x.com/Bigknivess/status/2071952371316654177' },
  { handle: 'sna2499', displayName: 'Sna2499', followers: 1580, goc: 1, reply: 0, views: 93, tone: 'Trung lập', links: 'https://x.com/Sna2499/status/2072964597389369376' },
  { handle: 'nguyent17504220', displayName: 'NguyenT17504220', followers: 1928, goc: 1, reply: 0, views: 89, tone: 'Bullish', links: 'https://x.com/NguyenT17504220/status/2072686168131727373' },
  { handle: 'bovabi38', displayName: 'BovaBi38', followers: 4406, goc: 1, reply: 0, views: 80, tone: 'Bullish', links: 'https://x.com/BovaBi38/status/2072557392630620279' },
  { handle: 'hang1856', displayName: 'hang1856', followers: 965, goc: 1, reply: 0, views: 68, tone: 'Bearish', links: 'https://x.com/hang1856/status/2072693759859679316' },
  { handle: 'chikoevm', displayName: 'chikoevm', followers: 5661, goc: 1, reply: 0, views: 63, tone: 'Hỗn hợp', links: 'https://x.com/chikoevm/status/2074034504407355453' },
  { handle: 'heanutie', displayName: 'heanutie', followers: 2556, goc: 1, reply: 0, views: 52, tone: 'Bullish', links: 'https://x.com/heanutie/status/2071570170552914397' },
  { handle: 'validator247', displayName: 'Validator247', followers: 1666, goc: 1, reply: 0, views: 52, tone: 'Bullish', links: 'https://x.com/Validator247/status/2072122684822233255' },
  { handle: 'gaming1_nh', displayName: 'gaming1_nh', followers: 1655, goc: 1, reply: 0, views: 50, tone: 'Bullish', links: 'https://x.com/gaming1_nh/status/2077041426576322954' },
  { handle: 'phanxuanthang5', displayName: 'PhanXuanThang5', followers: 1616, goc: 1, reply: 0, views: 48, tone: 'Trung lập', links: 'https://x.com/PhanXuanThang5/status/2074482573238304879' },
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
  // also match panxuanthang5 typo from older export
  if (!actor && h === 'phanxuanthang5') {
    actor = actors.find((a) => a.handle.toLowerCase() === 'panxuanthang5')
    if (actor) {
      actor.handle = 'phanxuanthang5'
      actor.id = 'a_phanxuanthang5'
    }
  }
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

  const handlePosts = posts.filter(
    (p) => p.handle === h || p.handle === actor.handle,
  )
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
  `Batch posts +${added} (Tungthuocno, DaveyNFTsAI, VnInvestBlogger, hang1856, …).`,
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
