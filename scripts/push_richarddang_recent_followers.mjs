/**
 * Merge @RichardDang recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_richarddang_recent_followers.mjs
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

const richarddang = [
  { handle: '0x2222_', displayName: '鸽子', followedAgo: '16 days ago', followedAt: '2026-07-26T00:00:00.000Z' },
  { handle: 'chouchou_tx', displayName: '丑丑TX', followedAgo: 'a month ago', followedAt: '2026-07-11T00:00:00.000Z' },
  { handle: 'ventureweb3', displayName: 'ar://web3vc', followedAgo: 'a month ago', followedAt: '2026-07-10T00:00:00.000Z' },
  { handle: 'jasonmdesimone', displayName: 'Jason Desimone ⚔️', followedAgo: 'a month ago', followedAt: '2026-07-09T00:00:00.000Z' },
  { handle: 'xingzhanai', displayName: 'XZ 星展', followedAgo: 'a month ago', followedAt: '2026-07-08T00:00:00.000Z' },
  { handle: 'sjl166', displayName: '斯嘉丽 Scar', followedAgo: '2 months ago', followedAt: '2026-06-11T00:00:00.000Z' },
  { handle: 'nicjiang7', displayName: 'Nic', followedAgo: '2 months ago', followedAt: '2026-06-10T00:00:00.000Z' },
  { handle: '0xethanh', displayName: 'EH', followedAgo: '2 months ago', followedAt: '2026-06-09T00:00:00.000Z' },
  { handle: 'web3xwg', displayName: '小伍哥 | Gate 美股0费率', followedAgo: '2 months ago', followedAt: '2026-06-08T00:00:00.000Z' },
  { handle: 'phill76815', displayName: '龙神-Dragon God', followedAgo: '2 months ago', followedAt: '2026-06-07T00:00:00.000Z' },
  { handle: 'jimmyshequ', displayName: "JIM'S FRIENDS 买美股上币安", followedAgo: '2 months ago', followedAt: '2026-06-06T00:00:00.000Z' },
  { handle: 'chanceyawn', displayName: '阳成AI', followedAgo: '2 months ago', followedAt: '2026-06-05T00:00:00.000Z' },
  { handle: 'oknextlin', displayName: '大栗子', followedAgo: '2 months ago', followedAt: '2026-06-04T00:00:00.000Z' },
  { handle: 'tuge8888', displayName: '寻一方净土', followedAgo: '2 months ago', followedAt: '2026-06-03T00:00:00.000Z' },
  { handle: 'flcjbtc', displayName: '飞龙财经', followedAgo: '2 months ago', followedAt: '2026-06-02T00:00:00.000Z' },
  { handle: 'wilsonye2025', displayName: 'Wilson Ye', followedAgo: '2 months ago', followedAt: '2026-06-01T00:00:00.000Z' },
  { handle: 'chenchen4410999', displayName: '藍色彈塗魚', followedAgo: '2 months ago', followedAt: '2026-05-31T00:00:00.000Z' },
  { handle: 'btcbears', displayName: '旺牛牛仔', followedAgo: '2 months ago', followedAt: '2026-05-30T00:00:00.000Z' },
  { handle: 'hunter_nft', displayName: 'hunter berg', followedAgo: '2 months ago', followedAt: '2026-05-29T00:00:00.000Z' },
  { handle: 'nftunit01', displayName: 'NFT特攻队(,)', followedAgo: '4 months ago', followedAt: '2026-04-11T00:00:00.000Z' },
  { handle: 'evans666666', displayName: 'Evans.eth', followedAgo: '4 months ago', followedAt: '2026-04-10T00:00:00.000Z' },
  { handle: 'garyvgroup', displayName: 'GaryCoinAnk', followedAgo: '6 months ago', followedAt: '2026-02-11T00:00:00.000Z' },
  { handle: 'bitgrateful', displayName: 'Lawyered', followedAgo: '8 months ago', followedAt: '2025-12-11T00:00:00.000Z' },
  { handle: 'miaferrariii', displayName: 'Mia', followedAgo: '10 months ago', followedAt: '2025-10-11T00:00:00.000Z' },
  { handle: 'randhindi', displayName: 'Rand', followedAgo: 'a year ago', followedAt: '2025-08-11T00:00:00.000Z' },
  { handle: 'afangyuan', displayName: '方源', followedAgo: 'a year ago', followedAt: '2025-08-10T00:00:00.000Z' },
  { handle: 'cryptoamandal', displayName: '阿曼达要吃肉Amanda.eth', followedAgo: 'a year ago', followedAt: '2025-08-09T00:00:00.000Z' },
  { handle: 'liaoblove520', displayName: '龙猫·liaoblove', followedAgo: 'a year ago', followedAt: '2025-08-08T00:00:00.000Z' },
  { handle: 'ripeth', displayName: 'rip.eth', followedAgo: 'a year ago', followedAt: '2025-08-07T00:00:00.000Z' },
  { handle: 'btcdefidadi', displayName: 'Vincent', followedAgo: 'a year ago', followedAt: '2025-08-06T00:00:00.000Z' },
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

  map = { ...map, richarddang }
  console.log('Set map.richarddang =', richarddang.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · RichardDang recent followers curated',
    note: 'Update recent followers for @RichardDang (30 accounts)',
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
  const list = v.map?.richarddang
  console.log(
    'Verify richarddang:',
    Array.isArray(list) ? list.length + ' recent followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(
      list
        .slice(0, 8)
        .map((x) => `@${x.handle} (${x.followedAgo})`)
        .join(', '),
      list.length > 8 ? `… +${list.length - 8} more` : '',
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
