/**
 * Re-tag SCEX post/actor sentiment from body text, then rescore matrix.
 *
 *   node scripts/recompute_scex_sentiments.mjs
 *   node scripts/recompute_scex_sentiments.mjs --put
 *
 * Keep inferScexSentiment heuristics in sync with src/data/scexTracking.ts
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { spawnSync } from 'child_process'

const require = createRequire(import.meta.url)
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

const doPut = process.argv.includes('--put')
const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)

function foldVi(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Mirror of src/data/scexTracking.ts inferScexSentiment */
function inferScexSentiment(text) {
  const raw = String(text || '').trim()
  if (raw.length < 8) return 'neutral'
  const t = foldVi(raw)

  if (
    /\bscam\b|lua dao|rug\s*pull|\brug\b|sap san|phot scex/.test(t) ||
    /lừa đảo|sập sàn/.test(raw.toLowerCase())
  ) {
    return 'scam'
  }

  const hardNeg =
    /khong ra gi|qua rac|toan rac|rac qua|deu qua|tranh xa|dung dung|canh bao scam|otp.*khong gui|cong nghe v sao|buc minh/.test(
      t,
    ) || /không ra gì|tránh xa|đừng dùng|bực mình/.test(raw.toLowerCase())

  const strongBull =
    /ky ket|hop tac|thoa thuan|mou\b|bat tay|chuc mung|nha tai tro|tai tro vang|giai thuong|thuc day|chien luoc|partnership|sponsor|bullish|tich cuc|he sinh thai|dang cap|chinh thuc|tro thanh nha/.test(
      t,
    )

  const mildCrit =
    /lag|don so|non tre|ton dung luong|chua ho tro|con nhieu|cai thien|phai sinh|khong chiu noi|fomo|thac mac|lieu co phai|phan anh|thue 0|muot|chua tot|giao dien|thanh khoan/.test(
      t,
    )

  const softBull =
    /tham gia|dang ky|thu nghiem|demo|giao dich tren|lai duoc|top \d|bxh|dau truong|giai thuong|ref_code|ma gioi thieu/.test(
      t,
    )

  if (hardNeg && !strongBull) return 'bearish'
  if (strongBull && !hardNeg) return 'bullish'
  if (strongBull && hardNeg) return 'neutral'
  if (mildCrit && !strongBull) return 'neutral'
  if (softBull && !hardNeg) return 'bullish'
  return 'neutral'
}

function dominant(posts) {
  const counts = {
    bullish: 0,
    bearish: 0,
    neutral: 0,
    shill: 0,
    scam: 0,
  }
  for (const p of posts) {
    if (p.hidden) continue
    const s = p.sentiment || 'neutral'
    if (counts[s] != null) counts[s]++
    else counts.neutral++
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!total) return 'neutral'
  if (counts.scam > 0 && counts.scam >= counts.bullish) return 'scam'
  if (counts.bullish > 0 && counts.bearish > 0) {
    if (counts.bullish >= counts.bearish * 2) return 'bullish'
    if (counts.bearish >= counts.bullish * 2) return 'bearish'
    return 'neutral'
  }
  let best = 'neutral'
  let n = -1
  for (const k of ['bullish', 'neutral', 'bearish', 'shill', 'scam']) {
    if (counts[k] > n) {
      n = counts[k]
      best = k
    }
  }
  return best
}

let dataset = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'src/data/internal/scex-tracking.json'),
    'utf8',
  ),
)
let baseUpdatedAt = dataset.updatedAt
try {
  const liveRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
  if (liveRes.ok) {
    const live = await liveRes.json()
    if (live?.actors?.length) {
      dataset = live
      baseUpdatedAt = live.updatedAt
      console.log('loaded live', live.actors.length, live.posts?.length, live.updatedAt)
    }
  }
} catch (e) {
  console.warn('live load fail', e.message)
}

const flips = []
const posts = (dataset.posts || []).map((p) => {
  const text = String(p.text || '').trim()
  const thin =
    text.length < 20 ||
    /mention SCEX \(export|export gốc|export batch|list58|curated SCEX mention/i.test(
      text,
    )
  if (thin) return p
  const next = inferScexSentiment(text)
  if (next !== p.sentiment) {
    flips.push({
      h: p.handle,
      id: p.id,
      from: p.sentiment,
      to: next,
      text: text.slice(0, 100).replace(/\s+/g, ' '),
    })
    return {
      ...p,
      sentiment: next,
      notes: [p.notes, `sentiment:auto→${next}`]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 400),
    }
  }
  return p
})

const byHandle = new Map()
for (const p of posts) {
  const h = String(p.handle || '').toLowerCase()
  if (!byHandle.has(h)) byHandle.set(h, [])
  byHandle.get(h).push(p)
}

const actorFlips = []
const actors = (dataset.actors || []).map((a) => {
  const list = byHandle.get(String(a.handle).toLowerCase()) || []
  if (!list.length) return a
  const sentiment = dominant(list)
  const counts = { bullish: 0, bearish: 0 }
  for (const p of list) {
    if (p.hidden) continue
    if (p.sentiment === 'bullish') counts.bullish++
    if (p.sentiment === 'bearish' || p.sentiment === 'scam') counts.bearish++
  }
  let tags = a.tags || ''
  const mixed = counts.bullish > 0 && counts.bearish > 0
  if (mixed && !/mixed|hỗn|hon hop/i.test(tags)) {
    tags = tags ? `${tags},mixed` : 'mixed'
  }
  if (!mixed && /(?:^|,)mixed(?:,|$)/i.test(tags)) {
    tags = tags
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && !/^mixed$/i.test(x))
      .join(',')
  }
  if (sentiment !== a.sentiment) {
    actorFlips.push({ h: a.handle, from: a.sentiment, to: sentiment })
  }
  return { ...a, sentiment, tags: tags || undefined }
})

dataset = {
  ...dataset,
  posts,
  actors,
  updatedAt: new Date().toISOString(),
  note: [
    String(dataset.note || '').replace(/\s*· Sentiment[^.]*\.?/gi, ''),
    `Sentiment re-tagged from post text (${flips.length} post flips).`,
  ]
    .filter(Boolean)
    .join(' '),
}

const seedPaths = [
  path.join(ROOT, 'src/data/internal/scex-tracking.json'),
  path.join(ROOT, 'data/internal/scex-tracking.json'),
]
const json = JSON.stringify(dataset, null, 2) + '\n'
for (const p of seedPaths) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, json, 'utf8')
  console.log('wrote', p)
}

const postCounts = {}
for (const p of posts) postCounts[p.sentiment] = (postCounts[p.sentiment] || 0) + 1
const actorCounts = {}
for (const a of actors) actorCounts[a.sentiment] = (actorCounts[a.sentiment] || 0) + 1

console.log(
  JSON.stringify(
    {
      postFlips: flips.length,
      actorFlips: actorFlips.length,
      postCounts,
      actorCounts,
      samplePostFlips: flips.slice(0, 20),
      sampleActorFlips: actorFlips.slice(0, 15),
      remainingBearishPosts: posts
        .filter((p) => p.sentiment === 'bearish')
        .map((p) => ({
          h: p.handle,
          t: String(p.text || '')
            .slice(0, 90)
            .replace(/\s+/g, ' '),
        })),
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
  const putBody = { ...dataset, baseUpdatedAt }
  const putRes = await adminPutJson(`${base}/api/scex-tracking`, token, putBody)
  console.log('PUT', putRes.status, (await putRes.text()).slice(0, 280))
  if (!putRes.ok) process.exit(1)
}

// Chain matrix rescore so quality tracks new sentiment
console.log('Running matrix rescore…')
const r = spawnSync(
  process.execPath,
  [path.join(ROOT, 'scripts/recompute_scex_scores.mjs'), ...(doPut ? ['--put'] : [])],
  { cwd: ROOT, stdio: 'inherit', env: process.env },
)
if (r.status !== 0) process.exit(r.status || 1)
