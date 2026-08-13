/**
 * Merge @kt_btc recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_kt_btc_recent_followers.mjs
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

const kt_btc = [
  { handle: 'qiuseoflove', displayName: '叶知秋', followedAgo: '4 days ago', followedAt: '2026-08-07T00:00:00.000Z' },
  { handle: 'bitcoinpalmer', displayName: 'palmer // not for everyone', followedAgo: '12 days ago', followedAt: '2026-07-30T00:00:00.000Z' },
  { handle: 'evans666666', displayName: 'Evans.eth', followedAgo: '2 months ago', followedAt: '2026-06-11T00:00:00.000Z' },
  { handle: 'renaissxyz', displayName: 'Renaiss.xyz', followedAgo: '3 months ago', followedAt: '2026-05-11T00:00:00.000Z' },
  { handle: 'erickpinos', displayName: 'Erick Pinos', followedAgo: '3 months ago', followedAt: '2026-05-10T00:00:00.000Z' },
  { handle: 'alpha_co', displayName: 'Alpha co', followedAgo: '8 months ago', followedAt: '2025-12-11T00:00:00.000Z' },
  { handle: 'joensmoon', displayName: '乔帮主退休月球收租', followedAgo: 'a year ago', followedAt: '2025-08-11T00:00:00.000Z' },
  { handle: 'cryptoamandal', displayName: '阿曼达要吃肉Amanda.eth', followedAgo: 'a year ago', followedAt: '2025-08-10T00:00:00.000Z' },
  { handle: '466anan', displayName: 'Crypto Nan', followedAgo: 'a year ago', followedAt: '2025-08-09T00:00:00.000Z' },
  { handle: 'defiapp', displayName: 'Defi App', followedAgo: 'a year ago', followedAt: '2025-08-08T00:00:00.000Z' },
  { handle: 'dakuan_x', displayName: '大匡', followedAgo: 'a year ago', followedAt: '2025-08-07T00:00:00.000Z' },
  { handle: 'daxianvip', displayName: '大仙 |Gate美股0费率', followedAgo: 'a year ago', followedAt: '2025-08-06T00:00:00.000Z' },
  { handle: 'jetxbt', displayName: 'Jet', followedAgo: 'a year ago', followedAt: '2025-08-05T00:00:00.000Z' },
  { handle: 'gala_nft1', displayName: 'gala⚡', followedAgo: 'a year ago', followedAt: '2025-08-04T00:00:00.000Z' },
  { handle: 'gala_nft2', displayName: 'gala⚡', followedAgo: 'a year ago', followedAt: '2025-08-03T00:00:00.000Z' },
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

  map = { ...map, kt_btc }
  console.log('Set map.kt_btc =', kt_btc.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · kt_btc recent followers curated',
    note: 'Update recent followers for @kt_btc (15 accounts)',
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
  const list = v.map?.kt_btc
  console.log(
    'Verify kt_btc:',
    Array.isArray(list) ? list.length + ' recent followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(
      list.map((x) => `@${x.handle} (${x.followedAgo})`).join(', '),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
