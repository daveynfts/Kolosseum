/**
 * Bulk-set all KOL reports visibility=public and PUT to R2.
 *   node scripts/publish_all_kol_reports.mjs
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
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
    if (v && !process.env[k]) process.env[k] = v
  }
}
loadEnv('.env.local')
loadEnv('.env.production.local')

const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)
if (!token) {
  console.error('Missing FEED_ADMIN_TOKEN')
  process.exit(1)
}

const now = new Date().toISOString()

let ds = null
const getRes = await fetch(`${base}/api/kol-reports?all=1&t=${Date.now()}`, {
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  },
})
if (getRes.ok) {
  ds = await getRes.json()
  console.log('Loaded from server', getRes.status)
} else {
  const seed = path.join(ROOT, 'src/data/internal/kol-reports.json')
  ds = JSON.parse(fs.readFileSync(seed, 'utf8'))
  console.log('Loaded from seed (server', getRes.status, ')')
}

if (!Array.isArray(ds.reports)) ds.reports = []
if (!Array.isArray(ds.trash)) ds.trash = []

let changed = 0
for (const r of ds.reports) {
  if (r.visibility !== 'public') {
    r.visibility = 'public'
    r.updatedAt = now
    r.changelog = [
      {
        id: `cl_pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        at: now,
        action: 'publish',
        by: 'admin_script',
        summary: 'Bulk publish all reports → public (Surf AI web viewer)',
      },
      ...(Array.isArray(r.changelog) ? r.changelog : []),
    ].slice(0, 200)
    changed++
  }
}

ds.kind = 'kol-reports'
ds.version = ds.version || 1
ds.updatedAt = now
ds.asOf = now
ds.note = `KOL reports · ${ds.reports.length} public · bulk published ${now}`

const putRes = await adminPutJson(`${base}/api/kol-reports`, token, ds)
const putText = await putRes.text()
console.log('PUT', putRes.status, putText.slice(0, 300))
if (!putRes.ok) process.exit(1)

const json = JSON.stringify(ds, null, 2) + '\n'
const seedPath = path.join(ROOT, 'src/data/internal/kol-reports.json')
const dataPath = path.join(ROOT, 'data/internal/kol-reports.json')
fs.mkdirSync(path.dirname(seedPath), { recursive: true })
fs.mkdirSync(path.dirname(dataPath), { recursive: true })
fs.writeFileSync(seedPath, json, 'utf8')
fs.writeFileSync(dataPath, json, 'utf8')
console.log('wrote local seeds')

const pub = await fetch(`${base}/api/kol-reports?t=${Date.now()}`)
const pubj = await pub.json()
console.log(
  JSON.stringify(
    {
      changed,
      total: ds.reports.length,
      publicApiStatus: pub.status,
      publicApiCount: Array.isArray(pubj.reports) ? pubj.reports.length : 0,
      handles: (pubj.reports || []).map((r) => r.handle),
    },
    null,
    2,
  ),
)
