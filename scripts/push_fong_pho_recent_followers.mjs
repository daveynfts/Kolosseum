/**
 * Merge @Fong_Pho recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_fong_pho_recent_followers.mjs
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

const fong_pho = [
  {
    handle: 'skarly',
    displayName: 'skarly',
    followedAgo: '7 months ago',
    followedAt: '2026-01-11T00:00:00.000Z',
  },
  {
    handle: 'yayaa_nancy',
    displayName: 'Nancy X.',
    followedAgo: '8 months ago',
    followedAt: '2025-12-11T00:00:00.000Z',
  },
  {
    handle: 'cryptoguy777',
    displayName: 'CG777',
    followedAgo: '9 months ago',
    followedAt: '2025-11-11T00:00:00.000Z',
  },
  {
    handle: 'miaferrariii',
    displayName: 'Mia',
    followedAgo: '9 months ago',
    followedAt: '2025-11-10T00:00:00.000Z',
  },
  {
    handle: '466anan',
    displayName: 'Crypto Nan',
    followedAgo: '9 months ago',
    followedAt: '2025-11-09T00:00:00.000Z',
  },
  {
    handle: 'eeelistar',
    displayName: 'Elisa',
    followedAgo: '9 months ago',
    followedAt: '2025-11-08T00:00:00.000Z',
  },
  {
    handle: 'aaronteng',
    displayName: 'Aaron Teng 安伦',
    followedAgo: '10 months ago',
    followedAt: '2025-10-11T00:00:00.000Z',
  },
  {
    handle: 'dailax',
    displayName: 'Daila',
    followedAgo: 'a year ago',
    followedAt: '2025-08-11T00:00:00.000Z',
  },
  {
    handle: 'lukedanielg',
    displayName: 'Luke ✳️',
    followedAgo: 'a year ago',
    followedAt: '2025-08-10T00:00:00.000Z',
  },
  {
    handle: 'thepeengwin',
    displayName: 'AL ✳️',
    followedAgo: 'a year ago',
    followedAt: '2025-08-09T00:00:00.000Z',
  },
  {
    handle: 'raidenkrn',
    displayName: 'Raiden',
    followedAgo: 'a year ago',
    followedAt: '2025-08-08T00:00:00.000Z',
  },
  {
    handle: 'cashbowie',
    displayName: 'Michael Lee',
    followedAgo: 'a year ago',
    followedAt: '2025-08-07T00:00:00.000Z',
  },
  {
    handle: 'proofofely',
    displayName: 'Ely',
    followedAgo: 'a year ago',
    followedAt: '2025-08-06T00:00:00.000Z',
  },
  {
    handle: 'iceyyy_gaming',
    displayName: 'iceyyy',
    followedAgo: 'a year ago',
    followedAt: '2025-08-05T00:00:00.000Z',
  },
  {
    handle: '0xyy_7',
    displayName: '进击的鸭鸭 | AD | AmazingDuck',
    followedAgo: 'a year ago',
    followedAt: '2025-08-04T00:00:00.000Z',
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

  map = { ...map, fong_pho }
  console.log('Set map.fong_pho =', fong_pho.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · Fong_Pho recent followers curated',
    note: 'Update recent followers for @Fong_Pho (15 accounts: skarly … 0xyy_7)',
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
  const list = v.map?.fong_pho
  console.log(
    'Verify fong_pho:',
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
