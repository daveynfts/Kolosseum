/**
 * Merge ThuanCapital bio from seed into live kols payload and PUT to API/R2.
 * Usage: node --env-file=.env.local scripts/push_kols_thuan_bio.mjs
 *    or: node scripts/push_kols_thuan_bio.mjs  (loads .env.local manually)
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
    if (!process.env[k]) process.env[k] = v
  }
}

function extractSheetBio(handle) {
  const ts = fs.readFileSync(path.join(ROOT, 'src/data/sheetKols.ts'), 'utf8')
  const h = `"handle": "${handle}"`
  const hi = ts.indexOf(h)
  if (hi < 0) throw new Error(`handle ${handle} not in sheetKols`)
  const next = ts.indexOf('\n  {\n    "id":', hi + 1)
  const region = ts.slice(hi, next > 0 ? next : undefined)
  const key = '"bio": '
  const bi = region.indexOf(key)
  if (bi < 0) throw new Error('bio not found')
  let j = bi + key.length
  if (region[j] !== '"') throw new Error('bio not string')
  j++
  let out = ''
  while (j < region.length) {
    const c = region[j]
    if (c === '\\') {
      const n = region[j + 1]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === 'r') out += '\r'
      else if (n === '"' || n === '\\' || n === '/') out += n
      else if (n === 'u') {
        out += String.fromCharCode(parseInt(region.slice(j + 2, j + 6), 16))
        j += 6
        continue
      } else out += n
      j += 2
      continue
    }
    if (c === '"') break
    out += c
    j++
  }
  return out
}

function extractSheetFollowers(handle) {
  const ts = fs.readFileSync(path.join(ROOT, 'src/data/sheetKols.ts'), 'utf8')
  const h = `"handle": "${handle}"`
  const hi = ts.indexOf(h)
  const next = ts.indexOf('\n  {\n    "id":', hi + 1)
  const region = ts.slice(hi, next > 0 ? next : undefined)
  const m = region.match(/"followers":\s*(\d+)/)
  return m ? Number(m[1]) : null
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.production.local')

  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const apiBase =
    process.env.RADAR_API_BASE ||
    process.env.VITE_SITE_URL ||
    'https://radar.daveynfts.com'

  const bio = extractSheetBio('ThuanCapital')
  const followers = extractSheetFollowers('ThuanCapital')
  if (!bio.includes('TL;DR') && !bio.includes('công tâm')) {
    console.warn('warning: bio may not be the new assessment')
  }
  console.log('bio length', bio.length, 'followers', followers)

  // Prefer live server list so we don't clobber other admin edits
  let payload
  const getRes = await fetch(`${apiBase.replace(/\/$/, '')}/api/kols?t=${Date.now()}`)
  if (getRes.ok) {
    payload = await getRes.json()
    console.log('loaded live kols', payload.count || payload.kols?.length)
  } else {
    payload = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/kols-server-snapshot.json'), 'utf8'),
    )
    console.log('fallback snapshot', payload.count || payload.kols?.length)
  }

  let found = false
  for (const k of payload.kols || []) {
    if (String(k.handle || '').toLowerCase() === 'thuancapital') {
      k.bio = bio
      if (followers) k.followers = followers
      found = true
      break
    }
  }
  if (!found) throw new Error('ThuanCapital not in payload')

  payload.updatedAt = new Date().toISOString()
  payload.note = 'Update ThuanCapital overview assessment (công tâm)'
  payload.source = 'admin server · ThuanCapital bio refresh'
  payload.count = payload.kols.length
  payload.version = payload.version || 3

  // Write local snapshot
  fs.writeFileSync(
    path.join(ROOT, 'data/kols-server-snapshot.json'),
    JSON.stringify(payload, null, 2) + '\n',
  )
  console.log('wrote data/kols-server-snapshot.json')

  if (!token) {
    console.error('No FEED_ADMIN_TOKEN — cannot PUT server')
    process.exit(1)
  }

  const putRes = await fetch(`${apiBase.replace(/\/$/, '')}/api/kols`, {
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
  const v = await fetch(`${apiBase.replace(/\/$/, '')}/api/kols?t=${Date.now()}`)
  const vj = await v.json()
  const th = (vj.kols || []).find(
    (k) => String(k.handle).toLowerCase() === 'thuancapital',
  )
  console.log(
    'verify bio starts:',
    (th?.bio || '').slice(0, 100).replace(/\n/g, ' | '),
  )
  console.log('verify has assessment:', /TL;DR|7,5\/10|công tâm/.test(th?.bio || ''))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
