/**
 * Merge @Thienthien1305 recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_thienthien1305_recent_followers.mjs
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

const thienthien1305 = [
  {
    handle: 'martindale',
    displayName: 'Eric Martindale [₿]',
    followedAgo: '4 months ago',
    followedAt: '2026-03-27T00:00:00.000Z',
    score: 17112,
  },
  {
    handle: 'evans666666',
    displayName: 'Evans.eth🇨🇳 🇻🇳🇮🇩',
    followedAgo: '4 months ago',
    followedAt: '2026-03-26T00:00:00.000Z',
    score: 6837,
  },
  {
    handle: 'mrryanchi',
    displayName: 'Mr.RC｜𝟎𝐱𝐔',
    followedAgo: '10 months ago',
    followedAt: '2025-09-27T00:00:00.000Z',
    score: 6408,
  },
  {
    handle: 'lc_hk0x',
    displayName: 'LC🎮',
    followedAgo: '10 months ago',
    followedAt: '2025-09-26T00:00:00.000Z',
    score: 28298,
  },
  {
    handle: 'blockchainrese6',
    displayName: '陌陌',
    followedAgo: '1 year ago',
    followedAt: '2025-07-27T00:00:00.000Z',
    score: 7430,
  },
  {
    handle: 'afangyuan',
    displayName: '方源',
    followedAgo: '1 year ago',
    followedAt: '2025-07-26T00:00:00.000Z',
    score: 18401,
  },
  {
    handle: 'gala_nft1',
    displayName: 'gala⚡',
    followedAgo: '1 year ago',
    followedAt: '2025-07-25T00:00:00.000Z',
    score: 21830,
  },
  {
    handle: 'cryptoamandal',
    displayName: '阿曼达要吃肉Amanda.eth',
    followedAgo: '1 year ago',
    followedAt: '2025-07-24T00:00:00.000Z',
    score: 5626,
  },
  {
    handle: 'metaio102',
    displayName: 'Meta',
    followedAgo: '1 year ago',
    followedAt: '2025-07-23T00:00:00.000Z',
    score: 4039,
  },
  {
    handle: 'nero8888',
    displayName: '🌱Nero',
    followedAgo: '1 year ago',
    followedAt: '2025-07-22T00:00:00.000Z',
    score: 6167,
  },
  {
    handle: 'hm010169',
    displayName: '币圈荒木｜Araki🪵',
    followedAgo: '1 year ago',
    followedAt: '2025-07-21T00:00:00.000Z',
    score: 2810,
  },
  {
    handle: 'gala_nft2',
    displayName: 'gala⚡',
    followedAgo: '1 year ago',
    followedAt: '2025-07-20T00:00:00.000Z',
    score: 6880,
  },
  {
    handle: '466anan',
    displayName: 'Crypto Nan',
    followedAgo: '1 year ago',
    followedAt: '2025-07-19T00:00:00.000Z',
    score: 9077,
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

  map = { ...map, thienthien1305 }
  console.log('Set map.thienthien1305 =', thienthien1305.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · Thienthien1305 recent followers curated',
    note: 'Update recent followers for @Thienthien1305',
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
  const list = v.map?.thienthien1305
  console.log(
    'Verify thienthien1305:',
    Array.isArray(list) ? list.length + ' recent followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(
      list
        .map(
          (x) =>
            `@${x.handle} (${x.followedAgo}${x.score != null ? `, ${x.score}` : ''})`,
        )
        .join(', '),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
