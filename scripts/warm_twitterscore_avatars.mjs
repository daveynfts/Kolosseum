/**
 * Warm X avatars for all TwitterScore benchmark handles → R2 radar/avatars/{handle}.jpg
 *
 *   node scripts/warm_twitterscore_avatars.mjs
 *   node scripts/warm_twitterscore_avatars.mjs --limit 50
 *   node scripts/warm_twitterscore_avatars.mjs --offset 100 --limit 200
 *   node scripts/warm_twitterscore_avatars.mjs --force   # re-fetch even if R2 has object
 *   node scripts/warm_twitterscore_avatars.mjs --concurrency 4
 *
 * Uses PUT /api/avatar?handle= (empty body → server fetches fxtwitter/unavatar → R2).
 * Skips handles that already exist on R2 (GET /api/avatar) unless --force.
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

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  if (v == null || v.startsWith('--')) return fallback
  return v
}

const force = process.argv.includes('--force')
const limit = Number(argVal('--limit', '0')) || 0
const offset = Number(argVal('--offset', '0')) || 0
const concurrency = Math.max(1, Math.min(8, Number(argVal('--concurrency', '3')) || 3))

const seedPath = path.join(ROOT, 'src/data/internal/twitterscore-top100.json')
const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
let handles = (data.accounts || [])
  .map((a) => String(a.handle || '').replace(/^@/, '').trim())
  .filter((h) => /^[A-Za-z0-9_]{1,30}$/.test(h))

// unique preserve order
const seen = new Set()
handles = handles.filter((h) => {
  const k = h.toLowerCase()
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

if (offset) handles = handles.slice(offset)
if (limit > 0) handles = handles.slice(0, limit)

console.log(
  JSON.stringify(
    {
      totalInSeed: data.accounts?.length,
      toWarm: handles.length,
      offset,
      limit: limit || 'all',
      concurrency,
      force,
      base,
    },
    null,
    2,
  ),
)

if (!token) {
  console.error('FEED_ADMIN_TOKEN missing (.env.local)')
  process.exit(1)
}

async function existsOnR2(handle) {
  try {
    const r = await fetch(
      `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
      { method: 'GET' },
    )
    return r.ok
  } catch {
    return false
  }
}

async function warmOne(handle) {
  if (!force) {
    const exists = await existsOnR2(handle)
    if (exists) return { handle, status: 'skip', reason: 'exists' }
  }
  const r = await fetch(
    `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
  const j = await r.json().catch(() => ({}))
  if (r.ok && j.ok) {
    return { handle, status: 'ok', bytes: j.bytes, url: j.url }
  }
  return {
    handle,
    status: 'fail',
    code: r.status,
    error: j.message || j.error || r.statusText,
  }
}

let ok = 0
let skip = 0
let fail = 0
const fails = []
let next = 0

async function worker(id) {
  while (next < handles.length) {
    const i = next++
    const h = handles[i]
    const n = i + 1
    process.stdout.write(`[${n}/${handles.length}] w${id} @${h}… `)
    try {
      const res = await warmOne(h)
      if (res.status === 'ok') {
        ok++
        console.log('ok', res.bytes || '', res.url || '')
      } else if (res.status === 'skip') {
        skip++
        console.log('skip (r2)')
      } else {
        fail++
        fails.push(res)
        console.log('fail', res.code || '', res.error || '')
      }
    } catch (e) {
      fail++
      fails.push({ handle: h, status: 'fail', error: e.message })
      console.log('err', e.message)
    }
    // polite delay between requests per worker
    await new Promise((r) => setTimeout(r, 200))
  }
}

const t0 = Date.now()
await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))
const sec = ((Date.now() - t0) / 1000).toFixed(1)

console.log(
  JSON.stringify(
    {
      done: true,
      ok,
      skip,
      fail,
      seconds: Number(sec),
      fails: fails.slice(0, 40),
      failCount: fails.length,
    },
    null,
    2,
  ),
)

if (fails.length) {
  const logPath = path.join(ROOT, 'data/internal/twitterscore-avatar-fails.json')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, JSON.stringify(fails, null, 2) + '\n')
  console.log('Wrote fail log →', logPath)
}

// exit 0 even with partial fails — re-run picks up skips
if (fail && !ok && !skip) process.exit(1)
