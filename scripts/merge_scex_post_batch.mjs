/**
 * Merge a batch of original-post status URLs into SCEX tracking seed.
 * Then: node scripts/hydrate_scex_media.mjs --via-api --put
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

const BATCH = [
  {
    handle: 'petertran_ct',
    displayName: 'Peter Tran',
    followers: 41900,
    goc: 2,
    reply: 0,
    views: 11314,
    tone: 'Hỗn hợp',
    links: `
https://x.com/PeterTran_CT/status/2072105402142195773
https://x.com/PeterTran_CT/status/2072286064648356293
`,
  },
  {
    handle: 'htp96_community',
    displayName: 'htp96_community',
    followers: 15900,
    goc: 2,
    reply: 0,
    views: 4980,
    tone: 'Hỗn hợp',
    links: `
https://x.com/htp96_community/status/2072224498972234238
https://x.com/htp96_community/status/2072631000891633702
`,
  },
  {
    handle: 'tianthachpp',
    displayName: 'TianThachpp',
    followers: 3607,
    goc: 2,
    reply: 0,
    views: 799,
    tone: 'Hỗn hợp',
    links: `
https://x.com/TianThachpp/status/2073602672238985220
https://x.com/TianThachpp/status/2075828654932959674
`,
  },
  {
    handle: 'ricefarmernft',
    displayName: 'RiceFarmerNFT',
    followers: 17100,
    goc: 2,
    reply: 0,
    views: 759,
    tone: 'Hỗn hợp',
    links: `
https://x.com/RiceFarmerNFT/status/2074540746032677102
https://x.com/RiceFarmerNFT/status/2075302331625906489
`,
  },
  {
    handle: 'thienbtcrypto',
    displayName: 'thienbtcrypto',
    followers: 813,
    goc: 2,
    reply: 0,
    views: 728,
    tone: 'Hỗn hợp',
    links: `
https://x.com/thienbtcrypto/status/2073254611196993772
https://x.com/thienbtcrypto/status/2075811781868720238
`,
  },
  {
    handle: 'trieu6878',
    displayName: 'trieu6878',
    followers: 5481,
    goc: 2,
    reply: 0,
    views: 618,
    tone: 'Hỗn hợp',
    links: `
https://x.com/trieu6878/status/2072252123539222707
https://x.com/trieu6878/status/2074069174658458019
`,
  },
  {
    handle: 'udjat19',
    displayName: 'Udjat',
    followers: 4338,
    goc: 2,
    reply: 0,
    views: 590,
    tone: 'Hỗn hợp',
    links: `
https://x.com/Udjat19/status/2072092552732561637
https://x.com/Udjat19/status/2073654014215123227
`,
  },
  {
    handle: 'jupxeno',
    displayName: 'JupXeno',
    followers: 3522,
    goc: 2,
    reply: 0,
    views: 449,
    tone: 'Bullish',
    links: `
https://x.com/JupXeno/status/2071961611787780096
https://x.com/JupXeno/status/2075133334234317283
`,
  },
  {
    handle: 'aliba_79',
    displayName: 'Aliba_79',
    followers: 15800,
    goc: 2,
    reply: 0,
    views: 390,
    tone: 'Bullish',
    links: `
https://x.com/Aliba_79/status/2072610366769844292
https://x.com/Aliba_79/status/2072997251639652770
`,
  },
  {
    handle: 'bixunsn18049920',
    displayName: 'BiXunSn18049920',
    followers: 516,
    goc: 2,
    reply: 0,
    views: 299,
    tone: 'Hỗn hợp',
    links: `
https://x.com/BiXunSn18049920/status/2072129269535556040
https://x.com/BiXunSn18049920/status/2072245625782153386
`,
  },
  {
    handle: 'kenno1r',
    displayName: 'KenNo1r',
    followers: 2348,
    goc: 2,
    reply: 0,
    views: 159,
    tone: 'Hỗn hợp',
    links: `
https://x.com/KenNo1r/status/2072503384389878033
https://x.com/KenNo1r/status/2073346173344366722
`,
  },
  {
    handle: 'blockhaydotcom',
    displayName: 'blockhaydotcom',
    followers: 573,
    goc: 2,
    reply: 0,
    views: 106,
    tone: 'Trung lập',
    links: `
https://x.com/blockhaydotcom/status/2072189937777283183
https://x.com/blockhaydotcom/status/2072189940679712911
`,
  },
  {
    handle: 'lucasng990',
    displayName: 'Lucas',
    followers: 16800,
    goc: 1,
    reply: 4,
    views: 2868,
    tone: 'Trung lập',
    links: `
https://x.com/lucasng990/status/2072645882835816800
`,
  },
  {
    handle: 'liquid100x',
    displayName: 'Liquid100x',
    followers: 29700,
    goc: 1,
    reply: 3,
    views: 1626,
    tone: 'Bullish',
    links: `
https://x.com/Liquid100x/status/2075487185097363571
`,
  },
  {
    handle: 'vanquan_titans',
    displayName: 'Vanquan_titans',
    followers: 60200,
    goc: 1,
    reply: 3,
    views: 1038,
    tone: 'Bullish',
    links: `
https://x.com/Vanquan_titans/status/2073237863739613259
`,
  },
  {
    handle: 'giabao_crypto',
    displayName: 'Gia Bảo',
    followers: 19600,
    goc: 1,
    reply: 3,
    views: 965,
    tone: 'Trung lập',
    links: `
https://x.com/giabao_crypto/status/2072986530583633946
`,
  },
  {
    handle: 'leejetjet',
    displayName: 'LEEJETJET',
    followers: 15200,
    goc: 1,
    reply: 2,
    views: 3621,
    tone: 'Bullish',
    links: `
https://x.com/LEEJETJET/status/2076196181995364499
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
  `Batch posts +${added} (PeterTran, htp96, RiceFarmer, Liquid100x, …).`,
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
