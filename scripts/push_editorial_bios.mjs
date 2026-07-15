/**
 * Merge editorial bios from sheetKols into live /api/kols and PUT.
 * Usage (with token):
 *   FEED_ADMIN_TOKEN=... node scripts/push_editorial_bios.mjs
 *   or: npx vercel env run --environment production -- node scripts/push_editorial_bios.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

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
    // Prefer non-empty process.env; fill blanks from file
    if (!process.env[k] || process.env[k] === '') process.env[k] = v
  }
}

function isEditorial(bio) {
  if (!bio) return false
  return (
    bio.includes('TL;DR') ||
    bio.includes('Đánh giá công tâm') ||
    bio.includes('KOL Signal Score') ||
    bio.includes('SurfAI')
  )
}

async function main() {
  // Prefer production-style files last so non-empty wins if local blank
  loadEnvFile('.env.local')
  loadEnvFile('.env.production.local')
  loadEnvFile('.env.runtime')

  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const apiBase = (
    process.env.RADAR_API_BASE ||
    process.env.VITE_SITE_URL ||
    'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  // Prefer snapshot (updated by scripts/update_*_bio.py); fallback parse sheetKols.ts
  const snap = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/kols-server-snapshot.json'), 'utf8'),
  )
  const seedBy = new Map(
    (snap.kols || []).map((k) => [String(k.handle).toLowerCase(), k]),
  )
  // Sanity: if snapshot Emily is not editorial, refuse from sheetKols via regex
  const sheet = fs.readFileSync(path.join(ROOT, 'src/data/sheetKols.ts'), 'utf8')
  for (const handle of ['emilyyvuong', 'thuancapital']) {
    const cur = seedBy.get(handle)
    if (cur && isEditorial(cur.bio)) continue
    const h = `"handle": "${handle === 'emilyyvuong' ? 'emilyyvuong' : 'ThuanCapital'}"`
    const hi = sheet.indexOf(h)
    if (hi < 0) continue
    const next = sheet.indexOf('\n  {\n    "id":', hi + 1)
    const region = sheet.slice(hi, next > 0 ? next : undefined)
    const bm = region.match(/"bio":\s*"((?:\\.|[^"\\])*)"/)
    const fm = region.match(/"followers":\s*(\d+)/)
    if (!bm) continue
    const bio = JSON.parse(`"${bm[1]}"`)
    if (!isEditorial(bio)) continue
    seedBy.set(handle, {
      handle,
      bio,
      followers: fm ? Number(fm[1]) : cur?.followers,
    })
    console.log('seed from sheetKols', handle)
  }

  let live
  const getRes = await fetch(`${apiBase}/api/kols?t=${Date.now()}`)
  if (!getRes.ok) throw new Error(`GET kols ${getRes.status}`)
  live = await getRes.json()
  console.log('live kols', live.kols?.length)

  let n = 0
  for (const k of live.kols || []) {
    const s = seedBy.get(String(k.handle).toLowerCase())
    if (!s?.bio || !isEditorial(s.bio)) continue
    if (k.bio === s.bio && k.followers === s.followers) continue
    console.log('patch', k.handle, 'bio', (k.bio || '').slice(0, 40), '→', s.bio.slice(0, 40))
    k.bio = s.bio
    if (s.followers != null) k.followers = s.followers
    n++
  }
  console.log('patched', n)

  live.updatedAt = new Date().toISOString()
  live.note = 'Push editorial bios from seed (Emily, Thuan, …)'
  live.source = 'admin server · editorial bios'
  live.count = live.kols.length
  live.version = 4

  fs.writeFileSync(
    path.join(ROOT, 'data/kols-server-snapshot.json'),
    JSON.stringify(live, null, 2) + '\n',
  )

  if (!token) {
    console.error('FEED_ADMIN_TOKEN empty — wrote snapshot only')
    process.exit(2)
  }

  const putRes = await fetch(`${apiBase}/api/kols`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(live),
  })
  const body = await putRes.json().catch(() => ({}))
  console.log('PUT', putRes.status, body)
  if (!putRes.ok) process.exit(1)

  const v = await fetch(`${apiBase}/api/kols?t=${Date.now()}`)
  const vj = await v.json()
  const em = vj.kols.find((k) => k.handle.toLowerCase() === 'emilyyvuong')
  console.log('verify emily:', (em?.bio || '').slice(0, 120).replace(/\n/g, ' | '))
  console.log('ok editorial', isEditorial(em?.bio))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
