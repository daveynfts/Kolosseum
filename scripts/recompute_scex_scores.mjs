/**
 * Recompute SCEX matrix volumeScore + qualityScore with map-tier boosts.
 * Uses seed sheet KOLs for rank (offline) + optional live /api/kols.
 *
 *   node scripts/recompute_scex_scores.mjs
 *   node scripts/recompute_scex_scores.mjs --put
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Use compiled logic via dynamic import of TS through a small inline port
// (mirror of scoreScexActor — keep in sync with src/data/scexTracking.ts)

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

function defaultScoring() {
  return {
    volGocWeight: 1,
    volReplyWeight: 0.35,
    volViewsSoftWeight: 0.12,
    volLogCap: 14,
    volMapBoost: 6,
    wMapTier: 0.38,
    wSentiment: 0.22,
    wDepth: 0.25,
    wEngagement: 0.15,
    mapTierScores: {
      challenger: 95,
      master: 88,
      diamond: 78,
      platinum: 68,
      gold: 55,
      none: 40,
    },
    sentimentScores: {
      bullish: 74,
      neutral: 54,
      mixed: 58,
      bearish: 46,
      shill: 32,
      scam: 18,
    },
    useVolumeScore: true,
  }
}

function clamp01(n) {
  return Math.min(100, Math.max(0, n))
}
function logScale(value, cap) {
  return (100 * Math.log1p(Math.max(0, value))) / Math.log1p(Math.max(1, cap))
}

function parseGocReply(actor) {
  if (actor.gocPosts != null || actor.replyPosts != null) {
    return {
      goc: Math.max(0, Number(actor.gocPosts) || 0),
      reply: Math.max(0, Number(actor.replyPosts) || 0),
    }
  }
  const tags = actor.tags || ''
  const notes = actor.notes || ''
  const gocTag = tags.match(/goc:(\d+)/i)
  const replyTag = tags.match(/reply:(\d+)/i)
  if (gocTag || replyTag) {
    return {
      goc: gocTag ? Number(gocTag[1]) : 0,
      reply: replyTag ? Number(replyTag[1]) : 0,
    }
  }
  const gocNote = notes.match(/Gốc\s+(\d+)/i)
  const replyNote = notes.match(/Reply\s+(\d+)/i)
  if (gocNote || replyNote) {
    return {
      goc: gocNote ? Number(gocNote[1]) : 0,
      reply: replyNote ? Number(replyNote[1]) : 0,
    }
  }
  return { goc: Math.max(0, Number(actor.postsVolume) || 0), reply: 0 }
}

function isMixed(actor) {
  const t = `${actor.tags || ''} ${actor.notes || ''}`.toLowerCase()
  return /mixed|hỗn hợp|hon hop|hỗn/.test(t)
}

function resolveMapRank(mapKol) {
  if (!mapKol) return 'none'
  const r = String(mapKol.rank || '').toLowerCase()
  if (['challenger', 'master', 'diamond', 'platinum', 'gold'].includes(r))
    return r
  const tier = mapKol.tier ?? 3
  const score = mapKol.score ?? 50
  if (tier <= 1) return score >= 96 ? 'challenger' : 'master'
  if (tier === 2) return score >= 92 ? 'diamond' : 'platinum'
  return 'gold'
}

function computeQuadrant(volume, quality, volumeSplit, qualitySplit) {
  const highVol = volume >= volumeSplit
  const highQ = quality >= qualitySplit
  if (highVol && highQ) return 'stars'
  if (!highVol && highQ) return 'nurture'
  if (highVol && !highQ) return 'noise'
  return 'ignore'
}

function scoreActor(actor, config, mapKol) {
  const sc = { ...defaultScoring(), ...(config.scoring || {}) }
  sc.mapTierScores = {
    ...defaultScoring().mapTierScores,
    ...(sc.mapTierScores || {}),
  }
  sc.sentimentScores = {
    ...defaultScoring().sentimentScores,
    ...(sc.sentimentScores || {}),
  }
  const { goc, reply } = parseGocReply(actor)
  const views = Number(actor.reach7d) || 0
  const followers = Math.max(0, Number(actor.followers) || 0)
  const mapKey = resolveMapRank(mapKol)
  const mapPart = sc.mapTierScores[mapKey] ?? 40

  const viewsSoft = Math.log1p(views) * (sc.volViewsSoftWeight ?? 0.12)
  const activity =
    goc * (sc.volGocWeight ?? 1) +
    reply * (sc.volReplyWeight ?? 0.35) +
    viewsSoft
  let volumeScore = logScale(activity, sc.volLogCap ?? 14)
  if (mapKey !== 'none') volumeScore += sc.volMapBoost ?? 6
  volumeScore = clamp01(volumeScore)

  const mixed = isMixed(actor)
  const sentPart = mixed
    ? sc.sentimentScores.mixed
    : sc.sentimentScores[actor.sentiment] ?? sc.sentimentScores.neutral

  let depth =
    38 + Math.min(42, goc * 14) + Math.min(12, Math.log1p(reply) * 8)
  if (reply > goc * 4 && goc <= 2) depth -= 12
  if (goc >= 5) depth += 6
  depth = clamp01(depth)

  const vr = views / Math.max(followers, 1)
  const eng = clamp01(28 + Math.log10(vr * 500 + 1) * 28)

  const wM = sc.wMapTier ?? 0.38
  const wS = sc.wSentiment ?? 0.22
  const wD = sc.wDepth ?? 0.25
  const wE = sc.wEngagement ?? 0.15
  const wSum = Math.max(0.01, wM + wS + wD + wE)
  const qualityScore = clamp01(
    (mapPart * wM + sentPart * wS + depth * wD + eng * wE) / wSum,
  )

  const useVol = sc.useVolumeScore !== false
  const volForQuad = useVol ? volumeScore : actor.postsVolume
  const volumeSplit = config.volumeSplit ?? 42
  const qualitySplit = config.qualitySplit ?? 55
  const quadrant = computeQuadrant(
    volForQuad,
    qualityScore,
    volumeSplit,
    qualitySplit,
  )

  const mapLabel = mapKey === 'none' ? 'off-map' : mapKey
  const scoreLog = [
    `V=${Math.round(volumeScore)}(act=${activity.toFixed(2)} goc=${goc} reply=${reply} viewsSoft=${viewsSoft.toFixed(2)}${mapKey !== 'none' ? ` +mapBoost${sc.volMapBoost ?? 6}` : ''})`,
    `Q=${Math.round(qualityScore)}(map=${mapLabel}:${Math.round(mapPart)}×${wM} sent=${Math.round(sentPart)}×${wS} depth=${Math.round(depth)}×${wD} eng=${Math.round(eng)}×${wE})`,
    `quad=${quadrant} splitV=${volumeSplit}/Q=${qualitySplit}`,
  ].join(' · ')

  return {
    ...actor,
    gocPosts: goc,
    replyPosts: reply,
    postsVolume: goc + reply || actor.postsVolume,
    volumeScore: Math.round(volumeScore * 10) / 10,
    qualityScore: Math.round(qualityScore * 10) / 10,
    quadrant,
    mapRank: mapKey === 'none' ? undefined : mapKey,
    tier: mapKey === 'none' ? actor.tier : mapKey,
    scoreLog,
  }
}

async function loadMapKols() {
  const map = new Map()
  // Prefer live API
  try {
    const r = await fetch(`${base}/api/kols?t=${Date.now()}`)
    if (r.ok) {
      const body = await r.json()
      const list = body.kols || body || []
      for (const k of list) {
        const h = String(k.handle || '')
          .replace(/^@/, '')
          .toLowerCase()
        if (h) map.set(h, k)
      }
      console.log('map kols from API', map.size)
      return map
    }
  } catch (e) {
    console.warn('api kols fail', e.message)
  }
  // Fallback: try reading sheet export if available
  try {
    const sheetPath = path.join(ROOT, 'src/data/sheetKols.ts')
    // Not JSON — skip heavy parse; empty map still ok
    console.log('no live kols; scoring without map boosts where unknown')
  } catch {
    /* ignore */
  }
  return map
}

const seedPaths = [
  path.join(ROOT, 'src/data/internal/scex-tracking.json'),
  path.join(ROOT, 'data/internal/scex-tracking.json'),
]

const dataset = JSON.parse(fs.readFileSync(seedPaths[0], 'utf8'))
const mapKols = await loadMapKols()

// Ensure scoring config present with 0–100 axes
const scoring = {
  ...defaultScoring(),
  ...(dataset.config.scoring || {}),
  mapTierScores: {
    ...defaultScoring().mapTierScores,
    ...(dataset.config.scoring?.mapTierScores || {}),
  },
  sentimentScores: {
    ...defaultScoring().sentimentScores,
    ...(dataset.config.scoring?.sentimentScores || {}),
  },
}
dataset.config = {
  ...dataset.config,
  scoring,
  volumeAxis: {
    min: 0,
    max: 100,
    label: 'Điểm tần suất (log activity)',
  },
  qualityAxis: {
    min: 0,
    max: 100,
    label: 'Điểm chất lượng (tier + signal)',
  },
  volumeSplit: dataset.config.volumeSplit > 20 ? dataset.config.volumeSplit : 42,
  qualitySplit: dataset.config.qualitySplit ?? 55,
}

const actors = dataset.actors.map((a) =>
  scoreActor(a, dataset.config, mapKols.get(a.handle.toLowerCase())),
)

const order = { stars: 0, nurture: 1, noise: 2, ignore: 3 }
actors.sort((a, b) => {
  const da = order[a.quadrant] ?? 9
  const db = order[b.quadrant] ?? 9
  if (da !== db) return da - db
  if ((b.volumeScore || 0) !== (a.volumeScore || 0))
    return (b.volumeScore || 0) - (a.volumeScore || 0)
  return b.qualityScore - a.qualityScore
})

dataset.actors = actors
dataset.updatedAt = new Date().toISOString()
dataset.note = [
  String(dataset.note || '').replace(/\s*· Scores[^.]*\.?/gi, ''),
  `Scores recomputed (log volume + map-tier quality; eng weight low).`,
]
  .filter(Boolean)
  .join(' ')

const quads = {}
for (const a of actors) quads[a.quadrant] = (quads[a.quadrant] || 0) + 1
const onMap = actors.filter((a) => a.mapRank).length
const vols = actors.map((a) => a.volumeScore).sort((a, b) => a - b)
const qs = actors.map((a) => a.qualityScore).sort((a, b) => a - b)

const json = JSON.stringify(dataset, null, 2) + '\n'
for (const p of seedPaths) {
  fs.writeFileSync(p, json, 'utf8')
  console.log('wrote', p)
}

console.log(
  JSON.stringify(
    {
      actors: actors.length,
      onMap,
      quads,
      volumeScore: {
        min: vols[0],
        p50: vols[Math.floor(vols.length / 2)],
        max: vols[vols.length - 1],
      },
      qualityScore: {
        min: qs[0],
        p50: qs[Math.floor(qs.length / 2)],
        max: qs[qs.length - 1],
      },
      top: actors.slice(0, 10).map((a) => ({
        h: a.handle,
        V: a.volumeScore,
        Q: a.qualityScore,
        map: a.mapRank || '-',
        quad: a.quadrant,
        goc: a.gocPosts,
        reply: a.replyPosts,
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
  const putRes = await fetch(`${base}/api/scex-tracking`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dataset),
  })
  console.log('PUT', putRes.status, (await putRes.text()).slice(0, 280))
  if (!putRes.ok) process.exit(1)
}
