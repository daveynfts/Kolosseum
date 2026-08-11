/**
 * Merge @DG_doodles recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_dg_doodles_recent_followers.mjs
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

const dg_doodles = [
  {
    handle: 'jasonmdesimone',
    displayName: 'Jason Desimone ⚔️',
    followedAgo: '2 months ago',
    followedAt: '2026-06-11T00:00:00.000Z',
  },
  {
    handle: 'renaissxyz',
    displayName: 'Renaiss.xyz',
    followedAgo: '3 months ago',
    followedAt: '2026-05-11T00:00:00.000Z',
  },
  {
    handle: 'ripeth',
    displayName: 'rip.eth',
    followedAgo: '7 months ago',
    followedAt: '2026-01-11T00:00:00.000Z',
  },
  {
    handle: 'parallelairev',
    displayName: 'AiRev',
    followedAgo: '7 months ago',
    followedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    handle: '0xchenlaoshi',
    displayName: '舵主陈老师 | FWA Trade Club',
    followedAgo: '7 months ago',
    followedAt: '2026-01-09T00:00:00.000Z',
  },
  {
    handle: 'affinity_matrix',
    displayName: 'Akasha ★',
    followedAgo: '9 months ago',
    followedAt: '2025-11-11T00:00:00.000Z',
  },
]

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

  console.log('GET', `${apiBase}/api/recent-followers`)
  const getRes = await fetch(`${apiBase}/api/recent-followers?t=${Date.now()}`)
  let map = {}
  let smartMap = {}

  if (getRes.ok) {
    const body = await getRes.json()
    map = body.map && typeof body.map === 'object' ? body.map : {}
    smartMap =
      body.smartMap && typeof body.smartMap === 'object' ? body.smartMap : {}
    console.log(
      'Server OK · map:',
      Object.keys(map).length,
      '· smartMap:',
      Object.keys(smartMap).length,
    )
  } else if (getRes.status === 404) {
    console.log('Server empty — creating new map')
  } else {
    console.error('GET failed', getRes.status, await getRes.text())
    process.exit(1)
  }

  map = { ...map, dg_doodles }
  console.log('Set map.dg_doodles =', dg_doodles.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · DG_doodles recent followers curated',
    note: 'Update recent followers for @DG_doodles (6 accounts: jasonmdesimone … affinity_matrix)',
    count: Object.keys(map).length,
    map,
    smartMap: Object.keys(smartMap).length ? smartMap : undefined,
  }

  const putRes = await fetch(`${apiBase}/api/recent-followers`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const putBody = await putRes.json().catch(() => ({}))
  if (!putRes.ok) {
    console.error('PUT failed', putRes.status, putBody)
    process.exit(1)
  }
  console.log('PUT OK', putBody)

  const verify = await fetch(`${apiBase}/api/recent-followers?t=${Date.now()}`)
  const v = await verify.json()
  const list = v.map?.dg_doodles
  console.log(
    'Verify dg_doodles:',
    Array.isArray(list) ? list.length + ' recent followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(
      list
        .map((x) => `@${x.handle} (${x.followedAgo}) · ${x.displayName}`)
        .join('\n'),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
