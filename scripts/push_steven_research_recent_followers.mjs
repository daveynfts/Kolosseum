/**
 * Merge @Steven_Research recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_steven_research_recent_followers.mjs
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
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

const steven_research = [
  {
    handle: 'jupiterexchange',
    displayName: 'Jupiter',
    followedAgo: '5 months ago',
    followedAt: '2026-03-11T00:00:00.000Z',
  },
  {
    handle: 'layerggofficial',
    displayName: 'Layergg',
    followedAgo: '8 months ago',
    followedAt: '2025-12-11T00:00:00.000Z',
  },
  {
    handle: 'loi_luu',
    displayName: 'Loi Luu',
    followedAgo: '8 months ago',
    followedAt: '2025-12-10T00:00:00.000Z',
  },
  {
    handle: 'spottiewifi',
    displayName: 'Spottie',
    followedAgo: '8 months ago',
    followedAt: '2025-12-09T00:00:00.000Z',
  },
  {
    handle: 'kybernetwork',
    displayName: 'Kyber Network',
    followedAgo: '10 months ago',
    followedAt: '2025-10-11T00:00:00.000Z',
  },
  {
    handle: 'cryptoamandal',
    displayName: '阿曼达要吃肉Amanda.eth',
    followedAgo: 'a year ago',
    followedAt: '2025-08-11T00:00:00.000Z',
  },
  {
    handle: 'inkymaze',
    displayName: 'Nicholas Cannon',
    followedAgo: 'a year ago',
    followedAt: '2025-08-10T00:00:00.000Z',
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

  map = { ...map, steven_research }
  console.log('Set map.steven_research =', steven_research.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · Steven_Research recent followers curated',
    note: 'Update recent followers for @Steven_Research (7 accounts: jupiterexchange … inkymaze)',
    count: Object.keys(map).length,
    map,
    smartMap: Object.keys(smartMap).length ? smartMap : undefined,
  }

  const putRes = await adminPutJson(`${apiBase}/api/recent-followers`, token, payload)
  const putBody = await putRes.json().catch(() => ({}))
  if (!putRes.ok) {
    console.error('PUT failed', putRes.status, putBody)
    process.exit(1)
  }
  console.log('PUT OK', putBody)

  const verify = await fetch(`${apiBase}/api/recent-followers?t=${Date.now()}`)
  const v = await verify.json()
  const list = v.map?.steven_research
  console.log(
    'Verify steven_research:',
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
