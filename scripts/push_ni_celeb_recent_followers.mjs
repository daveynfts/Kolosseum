/**
 * Merge @ni_celeb recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_ni_celeb_recent_followers.mjs
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

const ni_celeb = [
  { handle: 'xbriansumner', displayName: 'Brian Sumner  BNB', followedAgo: '11 days ago', followedAt: '2026-07-31T00:00:00.000Z' },
  { handle: 'qiuseoflove', displayName: '叶知秋', followedAgo: '22 days ago', followedAt: '2026-07-20T00:00:00.000Z' },
  { handle: 'xingzhanai', displayName: 'XZ 星展', followedAgo: 'a month ago', followedAt: '2026-07-11T00:00:00.000Z' },
  { handle: 'leigesee', displayName: 'Leige', followedAgo: '2 months ago', followedAt: '2026-06-11T00:00:00.000Z' },
  { handle: 'ciciyingying', displayName: 'Cici', followedAgo: '2 months ago', followedAt: '2026-06-10T00:00:00.000Z' },
  { handle: 'poof_eth', displayName: 'poof', followedAgo: '6 months ago', followedAt: '2026-02-11T00:00:00.000Z' },
  { handle: 'ff_v12', displayName: 'FFV', followedAgo: '6 months ago', followedAt: '2026-02-10T00:00:00.000Z' },
  { handle: 'leaf_swan', displayName: 'Leafswan', followedAgo: '6 months ago', followedAt: '2026-02-09T00:00:00.000Z' },
  { handle: 'superl9', displayName: 'Wick李 BNB', followedAgo: '6 months ago', followedAt: '2026-02-08T00:00:00.000Z' },
  { handle: 'ericclfung', displayName: 'EricF', followedAgo: '7 months ago', followedAt: '2026-01-11T00:00:00.000Z' },
  { handle: 'chouchou_tx', displayName: '丑丑TX', followedAgo: '7 months ago', followedAt: '2026-01-10T00:00:00.000Z' },
  { handle: 'tortugo', displayName: 'Tortugo.HL', followedAgo: '7 months ago', followedAt: '2026-01-09T00:00:00.000Z' },
  { handle: 'krystal_eth', displayName: '加密Krystal', followedAgo: '7 months ago', followedAt: '2026-01-08T00:00:00.000Z' },
  { handle: 'chaozuoye', displayName: '作业借你抄 （吃瓜版）', followedAgo: '7 months ago', followedAt: '2026-01-07T00:00:00.000Z' },
  { handle: 'vegahao', displayName: 'Vega Hao', followedAgo: '7 months ago', followedAt: '2026-01-06T00:00:00.000Z' },
  { handle: 'x_sanjin', displayName: '熊三金Cole买美股上币安', followedAgo: '7 months ago', followedAt: '2026-01-05T00:00:00.000Z' },
  { handle: 'oceansbaby_', displayName: 'Cruise橘子哥', followedAgo: '7 months ago', followedAt: '2026-01-04T00:00:00.000Z' },
  { handle: 'scarlettweb3', displayName: 'Jingle Bell 初号机', followedAgo: '7 months ago', followedAt: '2026-01-03T00:00:00.000Z' },
  { handle: 'peiopeixiao', displayName: '加密笑哥|Gate美股0费率', followedAgo: '7 months ago', followedAt: '2026-01-02T00:00:00.000Z' },
  { handle: 'phill76815', displayName: '龙神-Dragon God', followedAgo: '7 months ago', followedAt: '2026-01-01T00:00:00.000Z' },
  { handle: 'li888real', displayName: 'Mr.理想三旬(,)(FREE,WON)', followedAgo: '7 months ago', followedAt: '2025-12-31T00:00:00.000Z' },
  { handle: 'wangy112375', displayName: '阿里嘎多美羊羊桑', followedAgo: '7 months ago', followedAt: '2025-12-30T00:00:00.000Z' },
  { handle: 'reboottttttt', displayName: 'Reboot.Btc', followedAgo: '7 months ago', followedAt: '2025-12-29T00:00:00.000Z' },
  { handle: 'jimmyshequ', displayName: "JIM'S FRIENDS 买美股上币安", followedAgo: '7 months ago', followedAt: '2025-12-28T00:00:00.000Z' },
  { handle: 'ripeth', displayName: 'rip.eth', followedAgo: '7 months ago', followedAt: '2025-12-27T00:00:00.000Z' },
  { handle: 'daxianvip', displayName: '大仙 |Gate美股0费率', followedAgo: '7 months ago', followedAt: '2025-12-26T00:00:00.000Z' },
  { handle: 'butongren6', displayName: 'BuTongRen', followedAgo: '7 months ago', followedAt: '2025-12-25T00:00:00.000Z' },
  { handle: '0xshunshun', displayName: '0xshun 順', followedAgo: '7 months ago', followedAt: '2025-12-24T00:00:00.000Z' },
  { handle: 'qmmmike', displayName: 'Miqi*', followedAgo: '7 months ago', followedAt: '2025-12-23T00:00:00.000Z' },
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

  map = { ...map, ni_celeb }
  console.log('Set map.ni_celeb =', ni_celeb.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · ni_celeb recent followers curated',
    note: 'Update recent followers for @ni_celeb (29 accounts)',
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
  const list = v.map?.ni_celeb
  console.log(
    'Verify ni_celeb:',
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
