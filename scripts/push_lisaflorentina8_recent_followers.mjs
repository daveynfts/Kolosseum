/**
 * Merge @LisaFlorentina8 recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_lisaflorentina8_recent_followers.mjs
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

const lisaflorentina8 = [
  { handle: 'mightydylank', displayName: 'Dylan K', followedAgo: '15 days ago', followedAt: '2026-07-27T00:00:00.000Z' },
  { handle: '0xmichael', displayName: 'Michael', followedAgo: '2 months ago', followedAt: '2026-06-11T00:00:00.000Z' },
  { handle: '0x1jf', displayName: '0x江峰.', followedAgo: '3 months ago', followedAt: '2026-05-11T00:00:00.000Z' },
  { handle: '0xaurskyo', displayName: '橘子 ∑:∞', followedAgo: '5 months ago', followedAt: '2026-03-11T00:00:00.000Z' },
  { handle: '0xg_e_d', displayName: 'G·E·D  BNB', followedAgo: '5 months ago', followedAt: '2026-03-10T00:00:00.000Z' },
  { handle: 'exianshengde', displayName: 'E先生', followedAgo: '5 months ago', followedAt: '2026-03-09T00:00:00.000Z' },
  { handle: 'cartist00', displayName: 'CARTIST', followedAgo: '7 months ago', followedAt: '2026-01-11T00:00:00.000Z' },
  { handle: 'chouchou_tx', displayName: '丑丑TX', followedAgo: '7 months ago', followedAt: '2026-01-10T00:00:00.000Z' },
  { handle: '0xyi666', displayName: '0xYi暖阳', followedAgo: '8 months ago', followedAt: '2025-12-11T00:00:00.000Z' },
  { handle: 'qingqingge152', displayName: '晴格格', followedAgo: '9 months ago', followedAt: '2025-11-11T00:00:00.000Z' },
  { handle: 'yjy616', displayName: '顾予', followedAgo: '9 months ago', followedAt: '2025-11-10T00:00:00.000Z' },
  { handle: 'butongren6', displayName: 'BuTongRen', followedAgo: '9 months ago', followedAt: '2025-11-09T00:00:00.000Z' },
  { handle: 'flyiiawei', displayName: 'flyawei', followedAgo: '9 months ago', followedAt: '2025-11-08T00:00:00.000Z' },
  { handle: 'realxiodos', displayName: '真诚小道士丨火币TradFi负费率', followedAgo: '9 months ago', followedAt: '2025-11-07T00:00:00.000Z' },
  { handle: 'btcdta', displayName: 'DTA', followedAgo: '9 months ago', followedAt: '2025-11-06T00:00:00.000Z' },
  { handle: 'zizhong999', displayName: '子重 BNB', followedAgo: '9 months ago', followedAt: '2025-11-05T00:00:00.000Z' },
  { handle: 'feifan7686', displayName: '飞凡', followedAgo: '9 months ago', followedAt: '2025-11-04T00:00:00.000Z' },
  { handle: 'the_wooo', displayName: 'memory', followedAgo: '9 months ago', followedAt: '2025-11-03T00:00:00.000Z' },
  { handle: 'daxianvip', displayName: '大仙 |Gate美股0费率', followedAgo: '10 months ago', followedAt: '2025-10-11T00:00:00.000Z' },
  { handle: 'kongbtc', displayName: 'Kong Trading', followedAgo: '10 months ago', followedAt: '2025-10-10T00:00:00.000Z' },
  { handle: 'mccain889', displayName: 'Andrew', followedAgo: '10 months ago', followedAt: '2025-10-09T00:00:00.000Z' },
  { handle: 'gn_zebraleyuan', displayName: '迪尔Dir.', followedAgo: '10 months ago', followedAt: '2025-10-08T00:00:00.000Z' },
  { handle: '0xzhaozhao', displayName: '0xzhaozhao', followedAgo: '10 months ago', followedAt: '2025-10-07T00:00:00.000Z' },
  { handle: 'cheesybun0211', displayName: '小汉堡  BNB', followedAgo: '10 months ago', followedAt: '2025-10-06T00:00:00.000Z' },
  { handle: '0xbclub', displayName: '摸金校尉 | 0xbclub', followedAgo: '10 months ago', followedAt: '2025-10-05T00:00:00.000Z' },
  { handle: 'eli5defi', displayName: 'Eli5DeFi', followedAgo: '10 months ago', followedAt: '2025-10-04T00:00:00.000Z' },
  { handle: 'aixuexi_ai', displayName: 'Engineer_AI', followedAgo: '10 months ago', followedAt: '2025-10-03T00:00:00.000Z' },
  { handle: 'fairyclub777', displayName: 'Fairy Club', followedAgo: 'a year ago', followedAt: '2025-08-11T00:00:00.000Z' },
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

  map = { ...map, lisaflorentina8 }
  console.log('Set map.lisaflorentina8 =', lisaflorentina8.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · LisaFlorentina8 recent followers curated',
    note: 'Update recent followers for @LisaFlorentina8 (28 accounts)',
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
  const list = v.map?.lisaflorentina8
  console.log(
    'Verify lisaflorentina8:',
    Array.isArray(list) ? list.length + ' recent followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(
      list
        .slice(0, 6)
        .map((x) => `@${x.handle} (${x.followedAgo})`)
        .join(', '),
      list.length > 6 ? `… +${list.length - 6} more` : '',
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
