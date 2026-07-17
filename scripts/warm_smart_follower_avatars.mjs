/**
 * Download X avatars for smart followers (and optional recent) → R2 radar/avatars/.
 *
 *   node scripts/warm_smart_follower_avatars.mjs
 *   node scripts/warm_smart_follower_avatars.mjs --handle martin_bml
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
const only = process.argv.includes('--handle')
  ? process.argv[process.argv.indexOf('--handle') + 1]?.toLowerCase()
  : null

function loadSmartSeed() {
  const ts = fs.readFileSync(
    path.join(ROOT, 'src/data/recentFollowers.ts'),
    'utf8',
  )
  const start = ts.indexOf('export const SMART_FOLLOWERS_BY_HANDLE')
  if (start < 0) throw new Error('SMART_FOLLOWERS_BY_HANDLE not found')
  const brace = ts.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = brace; i < ts.length; i++) {
    if (ts[i] === '{') depth++
    else if (ts[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return (${ts.slice(brace, end + 1)})`)()
}

const seed = loadSmartSeed()
const handles = new Set()
for (const [kol, list] of Object.entries(seed)) {
  if (only && kol !== only) continue
  for (const f of list || []) {
    const h = String(f.handle || '')
      .replace(/^@/, '')
      .trim()
    if (h) handles.add(h)
  }
}

console.log(
  'Warming',
  handles.size,
  'avatars',
  only ? `for KOL ${only}` : '(all smart lists)',
)
if (!token) {
  console.error('FEED_ADMIN_TOKEN missing')
  process.exit(1)
}

let ok = 0
let fail = 0
for (const h of [...handles]) {
  process.stdout.write(`  @${h}… `)
  try {
    const r = await fetch(
      `${base}/api/avatar?handle=${encodeURIComponent(h)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          // empty body → server fetches from fxtwitter
        },
      },
    )
    const j = await r.json().catch(() => ({}))
    if (r.ok && j.ok) {
      console.log('ok', j.bytes || '', j.url || '')
      ok++
    } else {
      console.log('fail', r.status, j.message || j.error || '')
      fail++
    }
  } catch (e) {
    console.log('err', e.message)
    fail++
  }
  await new Promise((r) => setTimeout(r, 350))
}
console.log('done ok', ok, 'fail', fail)
if (fail && !ok) process.exit(1)
