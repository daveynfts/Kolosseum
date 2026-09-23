/**
 * Audit or warm KOL avatars in the existing Radar R2 bucket.
 *
 * npm run avatars:sync               # read-only audit
 * npm run avatars:sync:apply         # upload missing images (needs FEED_ADMIN_TOKEN)
 * node scripts/warm_scex_avatars.mjs --apply --limit 50
 *
 * Reads the live SCEX dataset. Image bytes are fetched by the existing
 * authenticated /api/avatar endpoint and written directly to R2. This
 * script never downloads images to disk or creates a second avatar store.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const apply = args.includes('--apply')

function loadEnv(name) {
  const file = path.join(root, name)
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const at = text.indexOf('=')
    if (at < 0) continue
    const key = text.slice(0, at).trim()
    let value = text.slice(at + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value && !process.env[key]) process.env[key] = value
  }
}

function numberArg(name, fallback, maximum) {
  const at = args.indexOf(name)
  if (at < 0) return fallback
  const value = Number(args[at + 1])
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(name + ' requires a positive integer')
  }
  return Math.min(value, maximum)
}

loadEnv('.env.local')
loadEnv('.env.production.local')

const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(/\/$/, '')
const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const concurrency = numberArg('--concurrency', 3, 5)
const limit = numberArg('--limit', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
if (apply && !token) {
  throw new Error('FEED_ADMIN_TOKEN is required for --apply. Set it in .env.local; do not pass it on the command line.')
}

function withTimeout(ms) {
  return AbortSignal.timeout(ms)
}

const response = await fetch(base + '/api/scex-tracking', {
  headers: { Accept: 'application/json' },
  signal: withTimeout(20000),
})
if (!response.ok) throw new Error('Live SCEX dataset returned HTTP ' + response.status)
const dataset = await response.json()
if (!Array.isArray(dataset.actors) || !Array.isArray(dataset.posts)) {
  throw new Error('Live SCEX dataset has no actors/posts arrays')
}

const handles = new Map()
function add(handle, avatarUrl = '') {
  const clean = String(handle || '').replace(/^@/, '').trim()
  if (!/^[A-Za-z0-9_]{1,30}$/.test(clean)) return
  const key = clean.toLowerCase()
  const existing = handles.get(key)
  if (!existing) handles.set(key, { handle: clean, avatarUrl: String(avatarUrl || '') })
  else if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = String(avatarUrl)
}
for (const actor of dataset.actors) add(actor.handle, actor.avatarUrl)
for (const post of dataset.posts) add(post.handle)
const targets = [...handles.values()].slice(0, limit)

function sourceKey(url) {
  const match = String(url || '').match(/radar\/avatars\/([A-Za-z0-9_]+\.jpg)(?:[?#]|$)/i)
  return match ? 'radar/avatars/' + match[1] : ''
}

async function headKey(key) {
  const url = base + '/r2/' + key
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let result
    try {
      result = await fetch(url, { method: 'HEAD', signal: withTimeout(12000) })
    } catch (error) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
        continue
      }
      throw error
    }
    if (result.status === 404) return false
    if (result.ok) {
      const contentType = result.headers.get('content-type') || ''
      if (!contentType.startsWith('image/')) {
        throw new Error('Unexpected content type for ' + key + ': ' + contentType)
      }
      return true
    }
    if ((result.status === 429 || result.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
      continue
    }
    throw new Error('Avatar probe returned HTTP ' + result.status + ' for ' + key)
  }
  return false
}

async function exists(entry) {
  const exact = 'radar/avatars/' + entry.handle + '.jpg'
  const lower = 'radar/avatars/' + entry.handle.toLowerCase() + '.jpg'
  const candidates = [...new Set([sourceKey(entry.avatarUrl), exact, lower].filter(Boolean))]
  for (const key of candidates) {
    if (await headKey(key)) return key
  }
  return null
}

async function upload(handle) {
  const result = await fetch(base + '/api/avatar?handle=' + encodeURIComponent(handle), {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token },
    signal: withTimeout(45000),
  })
  const body = await result.json().catch(() => ({}))
  if (!result.ok || body.ok === false) {
    throw new Error('Avatar upload HTTP ' + result.status + ': ' + String(body.error || body.message || 'unknown'))
  }
  if (!String(body.key || '').startsWith('radar/avatars/')) {
    throw new Error('Avatar upload did not confirm an R2 key')
  }
  return body.key
}

const stats = { sourceActors: dataset.actors.length, sourcePosts: dataset.posts.length,
  uniqueHandles: handles.size, checked: 0, existing: 0, missing: 0, uploaded: 0, failed: 0 }
const errors = []
let cursor = 0
console.log(JSON.stringify({ mode: apply ? 'apply' : 'audit', base, concurrency,
  selected: targets.length, sourceAsOf: dataset.asOf || null }))

async function worker() {
  while (cursor < targets.length) {
    const entry = targets[cursor++]
    try {
      const key = await exists(entry)
      if (key) stats.existing += 1
      else {
        stats.missing += 1
        if (apply) {
          await upload(entry.handle)
          stats.uploaded += 1
        }
      }
    } catch (error) {
      stats.failed += 1
      errors.push({ handle: entry.handle, error: error instanceof Error ? error.message : String(error) })
    }
    stats.checked += 1
    if (stats.checked % 25 === 0 || stats.checked === targets.length) {
      console.log(JSON.stringify({ checked: stats.checked, total: targets.length,
        existing: stats.existing, missing: stats.missing, uploaded: stats.uploaded, failed: stats.failed }))
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()))
console.log(JSON.stringify({ ...stats, errors: errors.slice(0, 20) }, null, 2))
if (stats.failed) process.exitCode = 1
