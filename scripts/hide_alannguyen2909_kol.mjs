/**
 * Hide @AlanNguyen2909 from public map (keep full record for later promote).
 * Reason: inactive / quiet on X for a long time.
 *
 *   node scripts/hide_alannguyen2909_kol.mjs
 *   node scripts/hide_alannguyen2909_kol.mjs --unhide
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const unhide = process.argv.includes('--unhide')
const TARGET = 'alannguyen2909'

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
    process.env.RADAR_API_BASE ||
    process.env.VITE_SITE_URL ||
    'https://radar.daveynfts.com'
  ).replace(/\/$/, '')
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }

  const getRes = await fetch(`${apiBase}/api/kols?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  })
  if (!getRes.ok) throw new Error(`GET /api/kols ${getRes.status}`)
  const payload = await getRes.json()
  if (!payload?.kols?.length) throw new Error('No kols on server')

  const k = payload.kols.find(
    (x) => String(x.handle || '').replace(/^@/, '').toLowerCase() === TARGET,
  )
  if (!k) {
    console.error('Handle not found on server:', TARGET)
    process.exit(1)
  }

  k.hidden = !unhide
  console.log(unhide ? 'UNHIDE' : 'HIDE', k.handle, 'hidden=', k.hidden)

  payload.updatedAt = new Date().toISOString()
  payload.note = unhide
    ? 'admin · re-promote @AlanNguyen2909 to public map'
    : 'admin · hide @AlanNguyen2909 from public map (inactive / quiet on X — kept for promote later)'
  payload.source = 'admin server · hide_alannguyen2909_kol'
  payload.count = payload.kols.length
  payload.version = payload.version || 4

  fs.writeFileSync(
    path.join(ROOT, 'data/kols-server-snapshot.json'),
    JSON.stringify(payload, null, 2) + '\n',
  )

  const putRes = await adminPutJson(`${apiBase}/api/kols`, token, payload)
  const body = await putRes.json().catch(() => ({}))
  console.log('PUT', putRes.status, body)
  if (!putRes.ok) process.exit(1)

  const v = await fetch(`${apiBase}/api/kols?t=${Date.now()}`)
  const vj = await v.json()
  const vk = (vj.kols || []).find(
    (x) => String(x.handle || '').toLowerCase() === TARGET,
  )
  const visible = (vj.kols || []).filter((x) => !x.hidden).length
  console.log(
    'verify',
    vk?.handle,
    'hidden=',
    vk?.hidden,
    '· visible on map',
    visible,
    '/',
    (vj.kols || []).length,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
