/**
 * PUT src/data/internal/scex-tracking.json → R2 via /api/scex-tracking
 *   node scripts/put_scex_tracking.mjs
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
const seed = path.join(ROOT, 'src/data/internal/scex-tracking.json')
const dataset = JSON.parse(fs.readFileSync(seed, 'utf8'))

if (!token) {
  console.error('FEED_ADMIN_TOKEN missing')
  process.exit(1)
}

const putRes = await adminPutJson(`${base}/api/scex-tracking`, token, dataset)
console.log('PUT', putRes.status, (await putRes.text()).slice(0, 300))
if (!putRes.ok) process.exit(1)

const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
const got = await getRes.json()
console.log('GET', {
  status: getRes.status,
  matrixTitle: got.config?.matrixTitle,
  stars: got.config?.quadrantLabels?.stars?.title,
  posts: got.posts?.length,
})
