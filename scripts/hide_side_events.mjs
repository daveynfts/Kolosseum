/**
 * Soft-hide side events on R2 (remove from public events list).
 * Seed also uses hidden: true + normalizeDataset strips them.
 *
 *   node scripts/hide_side_events.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const HIDE_IDS = new Set([
  'ecv-wellness-golf-meets-pilates',
  'building-ai-powered-marketing-5k-walk',
])

function loadEnvFile(file) {
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
    ) {
      v = v.slice(1, -1)
    }
    if (v && (!process.env[k] || process.env[k] === '')) process.env[k] = v
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.production.local')
  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const apiBase = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }

  const getRes = await fetch(`${apiBase}/api/event-side-events?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  })
  if (!getRes.ok) {
    console.log('GET', getRes.status, '— no R2 dataset; seed deploy is enough')
    return
  }
  const body = await getRes.json()
  if (!Array.isArray(body.events)) {
    console.log('No events array on server')
    return
  }
  const before = body.events.length
  const removed = body.events.filter((e) => HIDE_IDS.has(String(e.id || '')))
  body.events = body.events.filter((e) => !HIDE_IDS.has(String(e.id || '')))
  body.updatedAt = new Date().toISOString()
  body.note =
    'Hide ECV Wellness + Building AI-Powered Marketing Systems (soft-hide)'
  console.log(
    'R2',
    before,
    '→',
    body.events.length,
    'removed',
    removed.map((e) => e.id).join(', ') || '(none present)',
  )

  const putRes = await fetch(`${apiBase}/api/event-side-events`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const putBody = await putRes.json().catch(() => ({}))
  console.log('PUT', putRes.status, putBody)
  if (!putRes.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
