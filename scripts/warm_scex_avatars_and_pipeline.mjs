/**
 * Warm missing SCEX actor avatars on R2 + tag Radar pipeline candidates.
 *
 *   node scripts/warm_scex_avatars_and_pipeline.mjs
 *   node scripts/warm_scex_avatars_and_pipeline.mjs --force
 *   node scripts/warm_scex_avatars_and_pipeline.mjs --new-only   # only list58 / blue / no avatar
 *   node scripts/warm_scex_avatars_and_pipeline.mjs --concurrency 3
 *
 * After warm: sets actor.avatarUrl, avatarWarmedAt, radarPipeline=candidate
 * (for off-map / new harvest handles), PUT /api/scex-tracking.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { adminPutJson } from './lib/adminPut.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED = path.join(ROOT, 'src/data/internal/scex-tracking.json')
const SEED2 = path.join(ROOT, 'data/internal/scex-tracking.json')

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
const base = (
  process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
).replace(/\/$/, '')
const R2_PUBLIC =
  process.env.VITE_R2_PUBLIC_URL ||
  process.env.R2_PUBLIC_URL ||
  'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev'

const force = process.argv.includes('--force')
const newOnly = process.argv.includes('--new-only')
const seedOnly = process.argv.includes('--seed-only')

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  if (v == null || v.startsWith('--')) return fallback
  return v
}
const concurrency = Math.max(
  1,
  Math.min(5, Number(argVal('--concurrency', '3')) || 3),
)

if (!token) {
  console.error('FEED_ADMIN_TOKEN missing')
  process.exit(1)
}

function avatarUrlFor(handle) {
  const safe = String(handle)
    .replace(/^@/, '')
    .trim()
    .replace(/[?#%\\/]/g, '')
  return `${String(R2_PUBLIC).replace(/\/$/, '')}/radar/avatars/${safe}.jpg`
}

function isNewHarvest(actor) {
  const notes = String(actor.notes || '')
  const tags = String(actor.tags || '')
  return (
    tags.includes('list58') ||
    notes.includes('list58') ||
    notes.includes('Blue Verified') ||
    notes.includes('Blue 7d') ||
    tags.includes('blue_verified') ||
    actor.radarPipeline === 'candidate'
  )
}

async function avatarExists(handle) {
  try {
    const r = await fetch(
      `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
    )
    if (!r.ok) return false
    const len = Number(r.headers.get('content-length') || 0)
    if (len > 0 && len < 400) return false
    // also probe R2 public
    const pub = await fetch(avatarUrlFor(handle), { method: 'HEAD' })
    if (pub.ok) {
      const cl = Number(pub.headers.get('content-length') || 0)
      if (cl > 400) return true
    }
    return true
  } catch {
    return false
  }
}

async function warmAvatar(handle) {
  const r = await fetch(
    `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  const text = await r.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 100) }
  }
  return {
    ok: r.ok,
    http: r.status,
    bytes: body.bytes,
    error: body.error || body.message,
    key: body.key,
    url: body.url || body.publicUrl,
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let dataset = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  if (!seedOnly) {
    console.log('GET', `${base}/api/scex-tracking`)
    const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
    if (getRes.ok) {
      const remote = await getRes.json()
      if (remote?.actors) {
        dataset = remote
        console.log('Using R2', {
          posts: remote.posts?.length,
          actors: remote.actors.length,
        })
      }
    }
  }

  const actors = Array.isArray(dataset.actors) ? [...dataset.actors] : []
  const byHandle = new Map(
    actors.map((a) => [String(a.handle).toLowerCase(), a]),
  )

  // Also warm brand
  if (!byHandle.has('scexofficial')) {
    /* skip actor create for brand */
  }

  let handles = [
    ...new Set([
      ...actors.map((a) =>
        String(a.handle || '')
          .replace(/^@/, '')
          .toLowerCase(),
      ),
      'scexofficial',
    ]),
  ].filter((h) => /^[a-z0-9_]{1,30}$/i.test(h))

  if (newOnly) {
    handles = handles.filter((h) => {
      if (h === 'scexofficial') return true
      const a = byHandle.get(h)
      if (!a) return true
      if (!a.avatarWarmedAt || !a.avatarUrl) return true
      return isNewHarvest(a)
    })
  }

  console.log(
    JSON.stringify(
      { total: handles.length, force, newOnly, concurrency, base },
      null,
      2,
    ),
  )

  const stats = { ok: 0, skip: 0, fail: 0, tagged: 0 }
  const fails = []
  let i = 0
  const now = new Date().toISOString()

  async function worker() {
    while (i < handles.length) {
      const idx = i++
      const h = handles[idx]
      let status = 'skip'
      let detail = ''

      const already =
        !force && (await avatarExists(h)) && byHandle.get(h)?.avatarWarmedAt

      if (already && !force) {
        status = 'skip'
        // still ensure metadata if actor exists
        const a = byHandle.get(h)
        if (a && !a.avatarUrl) {
          a.avatarUrl = avatarUrlFor(h)
          a.avatarWarmedAt = a.avatarWarmedAt || now
        }
      } else {
        try {
          const r = await warmAvatar(h)
          if (r.ok) {
            status = 'ok'
            stats.ok++
            detail = r.bytes != null ? `${r.bytes}b` : ''
            const a = byHandle.get(h)
            if (a) {
              a.avatarUrl = r.url || avatarUrlFor(h)
              a.avatarWarmedAt = now
            }
          } else {
            status = 'fail'
            stats.fail++
            detail = `${r.http} ${r.error || ''}`
            fails.push({ handle: h, ...r })
          }
        } catch (e) {
          status = 'fail'
          stats.fail++
          detail = e instanceof Error ? e.message : String(e)
          fails.push({ handle: h, error: detail })
        }
      }

      if (status === 'skip') stats.skip++

      // Tag radar pipeline for harvest / off-map actors
      const a = byHandle.get(h)
      if (a) {
        const offMap = !a.mapRank
        const harvest = isNewHarvest(a)
        if (
          !a.radarPipeline ||
          a.radarPipeline === 'none' ||
          a.radarPipeline === undefined
        ) {
          if (harvest || (offMap && harvest)) {
            a.radarPipeline = 'candidate'
            a.sourcedAt = a.sourcedAt || now.slice(0, 10)
            if (!String(a.tags || '').includes('radar_candidate')) {
              a.tags = [a.tags, 'radar_candidate'].filter(Boolean).join(',')
            }
            stats.tagged++
          }
        }
        // Ensure any warmed actor without pipeline stays explicit none only if already on map
        if (a.mapRank && !a.radarPipeline) {
          a.radarPipeline = 'none'
        }
      }

      console.log(
        `[${idx + 1}/${handles.length}] @${h} → ${status}${detail ? ` ${detail}` : ''}${a?.radarPipeline ? ` · pipeline=${a.radarPipeline}` : ''}`,
      )
      await sleep(220)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  // Mark all list58 / blue as candidate if still unset
  for (const a of actors) {
    if (isNewHarvest(a) && (!a.radarPipeline || a.radarPipeline === 'none')) {
      a.radarPipeline = 'candidate'
      a.sourcedAt = a.sourcedAt || now.slice(0, 10)
      if (!String(a.tags || '').includes('radar_candidate')) {
        a.tags = [a.tags, 'radar_candidate'].filter(Boolean).join(',')
      }
      stats.tagged++
    }
  }

  dataset.actors = actors
  dataset.updatedAt = now
  dataset.asOf = now.slice(0, 10)
  dataset.note = [
    String(dataset.note || ''),
    `Avatar warm ${now.slice(0, 10)}: ok ${stats.ok} skip ${stats.skip} fail ${stats.fail}; radar candidates tagged ~${stats.tagged}.`,
  ]
    .filter(Boolean)
    .join(' · ')

  const json = JSON.stringify(dataset, null, 2) + '\n'
  fs.writeFileSync(SEED, json)
  try {
    fs.writeFileSync(SEED2, json)
  } catch {
    /* optional */
  }

  const candidates = actors.filter((a) => a.radarPipeline === 'candidate')
  console.log(
    JSON.stringify(
      {
        ...stats,
        candidates: candidates.length,
        warmedWithUrl: actors.filter((a) => a.avatarUrl).length,
        fails: fails.slice(0, 25),
      },
      null,
      2,
    ),
  )

  if (seedOnly) {
    console.log('--seed-only: skip PUT')
    return
  }

  const putRes = await adminPutJson(
    `${base}/api/scex-tracking`,
    token,
    dataset,
  )
  console.log('PUT', putRes.status, (await putRes.text()).slice(0, 350))
  if (!putRes.ok) process.exit(1)
  if (stats.fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
