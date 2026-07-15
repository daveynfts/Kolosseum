/**
 * Patch one or more KOL bios on R2 via PUT /api/kols.
 * R2 is the display source of truth — do not rely on sheetKols seed for live map.
 *
 * Usage:
 *   node scripts/push_kol_bio.mjs --handle emilyyvuong --bio-file path/to/bio.txt
 *   node scripts/push_kol_bio.mjs --handle emilyyvuong --bio "line1\nline2"
 *   node scripts/push_kol_bio.mjs --from-json patches.json
 *     patches.json: { "emilyyvuong": { "bio": "...", "followers": 182312 }, ... }
 *
 * Env (any one works):
 *   FEED_ADMIN_TOKEN  — required for PUT
 *   RADAR_API_BASE    — default https://radar.daveynfts.com
 *   Loads .env.local / .env.production.local if present (non-empty values only)
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
  const out = {
    handle: null,
    bio: null,
    bioFile: null,
    fromJson: null,
    followers: null,
    displayName: null,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--handle') out.handle = argv[++i]
    else if (a === '--bio') out.bio = argv[++i]
    else if (a === '--bio-file') out.bioFile = argv[++i]
    else if (a === '--from-json') out.fromJson = argv[++i]
    else if (a === '--followers') out.followers = Number(argv[++i])
    else if (a === '--display-name') out.displayName = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

function unescapeBio(s) {
  return String(s).replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.production.local')
  loadEnvFile('.env.runtime')

  const args = parseArgs(process.argv)
  if (args.help) {
    console.log(`push_kol_bio.mjs — patch KOL bio on R2 (display source of truth)

  --handle HANDLE --bio "text" | --bio-file file.txt [--followers N]
  --from-json patches.json
`)
    process.exit(0)
  }

  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const apiBase = (
    process.env.RADAR_API_BASE ||
    process.env.VITE_SITE_URL ||
    'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  /** @type {Record<string, { bio?: string, followers?: number, displayName?: string }>} */
  const patches = {}

  if (args.fromJson) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(args.fromJson), 'utf8'))
    for (const [h, v] of Object.entries(raw)) {
      const key = h.replace(/^@/, '').trim().toLowerCase()
      if (typeof v === 'string') patches[key] = { bio: v }
      else
        patches[key] = {
          bio: v.bio,
          followers: v.followers,
          displayName: v.displayName,
        }
    }
  } else if (args.handle) {
    const key = args.handle.replace(/^@/, '').trim().toLowerCase()
    let bio = args.bio
    if (args.bioFile) {
      bio = fs.readFileSync(path.resolve(args.bioFile), 'utf8')
    }
    if (bio == null) {
      console.error('Need --bio or --bio-file')
      process.exit(1)
    }
    patches[key] = {
      bio: unescapeBio(bio).replace(/\r\n/g, '\n').trim(),
      followers: Number.isFinite(args.followers) ? args.followers : undefined,
      displayName: args.displayName || undefined,
    }
  } else {
    console.error('Need --handle … or --from-json …  (see --help)')
    process.exit(1)
  }

  if (!token) {
    console.error(
      'FEED_ADMIN_TOKEN missing. Set env or put non-empty value in .env.local',
    )
    process.exit(1)
  }

  // Bust CDN/browser caches so we never PUT a stale full list over a prior patch
  const getRes = await fetch(`${apiBase}/api/kols?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  })
  if (!getRes.ok) throw new Error(`GET /api/kols ${getRes.status}`)
  const payload = await getRes.json()
  if (!payload?.kols?.length) throw new Error('No kols on server')

  let n = 0
  for (const k of payload.kols) {
    const key = String(k.handle || '')
      .replace(/^@/, '')
      .trim()
      .toLowerCase()
    const p = patches[key]
    if (!p) continue
    if (p.bio != null) k.bio = p.bio
    if (p.followers != null) k.followers = p.followers
    if (p.displayName != null) k.displayName = p.displayName
    n++
    console.log(
      'patched',
      k.handle,
      'bioLen',
      (k.bio || '').length,
      p.followers != null ? `followers=${p.followers}` : '',
      p.displayName != null ? `name=${p.displayName}` : '',
    )
  }
  if (n === 0) {
    console.error('No matching handles on server:', Object.keys(patches))
    process.exit(1)
  }

  payload.updatedAt = new Date().toISOString()
  payload.note = `admin server · bio push (${Object.keys(patches).join(', ')})`
  payload.source = 'admin server · push_kol_bio'
  payload.count = payload.kols.length
  payload.version = payload.version || 4

  // Local mirror snapshot for offline tooling
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

  // Verify
  const v = await fetch(`${apiBase}/api/kols?t=${Date.now()}`)
  const vj = await v.json()
  for (const key of Object.keys(patches)) {
    const k = (vj.kols || []).find(
      (x) => String(x.handle).toLowerCase() === key,
    )
    console.log(
      'verify',
      key,
      (k?.bio || '').slice(0, 90).replace(/\n/g, ' | '),
    )
  }
  console.log('OK — R2 is source of truth for map display')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
