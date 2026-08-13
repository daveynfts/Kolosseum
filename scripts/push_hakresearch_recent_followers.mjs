/**
 * Merge @HakResearch recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_hakresearch_recent_followers.mjs
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

const hakresearch = [
  {
    handle: '0xsweep',
    displayName: 'Sweep',
    followedAgo: '25 days ago',
    followedAt: '2026-07-02T00:00:00.000Z',
    score: 1430,
  },
  {
    handle: 'greta0086',
    displayName: 'Greta008',
    followedAgo: '6 months ago',
    followedAt: '2026-01-27T00:00:00.000Z',
    score: 3395,
  },
  {
    handle: 'marcinredstone',
    displayName: 'Marcin Kazmierczak ♦️',
    followedAgo: '9 months ago',
    followedAt: '2025-10-27T00:00:00.000Z',
    score: 9331,
  },
  {
    handle: 'boredelonmusk',
    displayName: 'BORED',
    followedAgo: '10 months ago',
    followedAt: '2025-09-27T00:00:00.000Z',
    score: 140,
  },
  {
    handle: 'jtsong2',
    displayName: 'Jtsong.eth (Ø,G)',
    followedAgo: '1 year ago',
    followedAt: '2025-07-27T00:00:00.000Z',
    score: 4180,
  },
  {
    handle: 'jeffmindfulness',
    displayName: 'Jeff | Mindfulness',
    followedAgo: '1 year ago',
    followedAt: '2025-07-26T00:00:00.000Z',
    score: 19108,
  },
  {
    handle: 'defiignas',
    displayName: 'Ignas | DeFi',
    followedAgo: '1 year ago',
    followedAt: '2025-07-25T00:00:00.000Z',
    score: 390,
  },
  {
    handle: 'serpinxbt',
    displayName: 'Serpin Taxt',
    followedAgo: '1 year ago',
    followedAt: '2025-07-24T00:00:00.000Z',
    score: 12697,
  },
  {
    handle: 'kkmoat',
    displayName: 'kkmoat.btc',
    followedAgo: '1 year ago',
    followedAt: '2025-07-23T00:00:00.000Z',
    score: 761,
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

  map = { ...map, hakresearch }
  console.log('Set map.hakresearch =', hakresearch.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · HakResearch recent followers curated',
    note: 'Update recent followers for @HakResearch',
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
  const list = v.map?.hakresearch
  console.log(
    'Verify hakresearch:',
    Array.isArray(list) ? list.length + ' recent followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(list.map((x) => `@${x.handle} (${x.followedAgo})`).join(', '))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
