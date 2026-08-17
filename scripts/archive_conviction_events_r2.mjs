/**
 * Mark Conviction side-events edition as archived on R2 (soft-archive).
 *
 *   node scripts/archive_conviction_events_r2.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

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

  const getRes = await fetch(`${apiBase}/api/event-side-events?event=conviction-2026&t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  })
  if (!getRes.ok) {
    console.error('GET failed', getRes.status)
    process.exit(1)
  }
  const body = await getRes.json()
  const baseUpdatedAt = body.updatedAt
  body.archived = true
  body.note =
    'Soft-archive: Conviction 2026 side-event week ended · browse-only map'
  if (!body.dateRange) {
    body.dateRange = { start: '2026-08-13', end: '2026-08-16' }
  }
  // Optimistic concurrency: server compares baseUpdatedAt to R2 current
  body.baseUpdatedAt = baseUpdatedAt

  const putRes = await fetch(`${apiBase}/api/event-side-events?event=conviction-2026`, {
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
  console.log('archived=', body.archived, 'events=', body.events?.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
