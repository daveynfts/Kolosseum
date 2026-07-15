/**
 * Add or upsert a KOL on R2 (source of truth).
 * Usage:
 *   node scripts/add_kol_r2.mjs --json path/to/kol.json
 *   node scripts/add_kol_r2.mjs --json -   (stdin)
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

function parseArgs(argv) {
  const out = { json: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--json') out.json = argv[++i]
  }
  return out
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.production.local')

  const args = parseArgs(process.argv)
  if (!args.json) {
    console.error('Need --json path')
    process.exit(1)
  }
  const raw =
    args.json === '-'
      ? fs.readFileSync(0, 'utf8')
      : fs.readFileSync(path.resolve(args.json), 'utf8')
  const kol = JSON.parse(raw)
  if (!kol.handle) {
    console.error('kol.handle required')
    process.exit(1)
  }

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

  const getRes = await fetch(`${apiBase}/api/kols?t=${Date.now()}`)
  if (!getRes.ok) throw new Error(`GET ${getRes.status}`)
  const payload = await getRes.json()
  const key = String(kol.handle).replace(/^@/, '').toLowerCase()
  const idx = (payload.kols || []).findIndex(
    (k) => String(k.handle).toLowerCase() === key,
  )
  if (idx >= 0) {
    payload.kols[idx] = { ...payload.kols[idx], ...kol }
    console.log('upsert', kol.handle)
  } else {
    payload.kols = [kol, ...(payload.kols || [])]
    console.log('insert', kol.handle)
  }

  payload.updatedAt = new Date().toISOString()
  payload.note = `admin server · add/upsert @${kol.handle}`
  payload.source = 'admin server · add_kol_r2'
  payload.count = payload.kols.length
  payload.version = payload.version || 4

  fs.writeFileSync(
    path.join(ROOT, 'data/kols-server-snapshot.json'),
    JSON.stringify(payload, null, 2) + '\n',
  )

  const putRes = await fetch(`${apiBase}/api/kols`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const body = await putRes.json().catch(() => ({}))
  console.log('PUT', putRes.status, body)
  if (!putRes.ok) process.exit(1)

  const v = await fetch(`${apiBase}/api/kols?t=${Date.now()}`)
  const vj = await v.json()
  const found = (vj.kols || []).find(
    (k) => String(k.handle).toLowerCase() === key,
  )
  console.log(
    'verify',
    found?.handle,
    'rank',
    found?.rank,
    'tier',
    found?.tier,
    'followers',
    found?.followers,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
