/**
 * Warm R2 avatars for all SCEX tracking handles.
 *
 *   node scripts/warm_scex_avatars.mjs
 *   node scripts/warm_scex_avatars.mjs --force
 *   node scripts/warm_scex_avatars.mjs --concurrency 3
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
const force = process.argv.includes('--force')

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

const seed = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/internal/scex-tracking.json'), 'utf8'),
)
const handles = [
  ...new Set([
    ...(seed.actors || []).map((a) =>
      String(a.handle || '')
        .replace(/^@/, '')
        .toLowerCase(),
    ),
    ...(seed.posts || []).map((p) =>
      String(p.handle || '')
        .replace(/^@/, '')
        .toLowerCase(),
    ),
    'scexofficial',
  ]),
].filter((h) => /^[a-z0-9_]{1,30}$/i.test(h))

console.log(
  JSON.stringify(
    { total: handles.length, force, concurrency, base },
    null,
    2,
  ),
)

async function exists(handle) {
  try {
    const r = await fetch(
      `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
    )
    if (!r.ok) return false
    const len = Number(r.headers.get('content-length') || 0)
    if (len > 0 && len < 400) return false
    return true
  } catch {
    return false
  }
}

async function warm(handle) {
  if (!force) {
    if (await exists(handle)) return { handle, status: 'skip' }
  }
  try {
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
      body = { raw: text.slice(0, 80) }
    }
    return {
      handle,
      status: r.ok ? 'ok' : 'fail',
      http: r.status,
      bytes: body.bytes,
      error: body.error || body.message,
    }
  } catch (e) {
    return {
      handle,
      status: 'fail',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

const stats = { ok: 0, skip: 0, fail: 0 }
const fails = []
let i = 0

async function worker() {
  while (i < handles.length) {
    const idx = i++
    const h = handles[idx]
    const r = await warm(h)
    if (r.status === 'ok') stats.ok++
    else if (r.status === 'skip') stats.skip++
    else {
      stats.fail++
      fails.push(r)
    }
    console.log(
      `[${idx + 1}/${handles.length}] ${h} → ${r.status}${r.http ? ` ${r.http}` : ''}${r.bytes != null ? ` ${r.bytes}b` : ''}${r.error ? ` ${r.error}` : ''}`,
    )
    await new Promise((res) => setTimeout(res, 200))
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))
console.log(JSON.stringify({ ...stats, fails: fails.slice(0, 30) }, null, 2))
if (stats.fail > 0) process.exitCode = 1
