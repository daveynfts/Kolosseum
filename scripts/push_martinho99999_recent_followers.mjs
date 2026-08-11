/**
 * Merge @MartinHo99999 (Martin Ho) recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_martinho99999_recent_followers.mjs
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

const martinho99999 = [
  { handle: 'yatmuseum', displayName: '✨  ✨', followedAgo: '3 days ago', followedAt: '2026-08-08T00:00:00.000Z' },
  { handle: 'fugui8', displayName: '香港王富贵', followedAgo: '4 days ago', followedAt: '2026-08-07T00:00:00.000Z' },
  { handle: 'cryptobaofu', displayName: '暴富锦李', followedAgo: '5 days ago', followedAt: '2026-08-06T00:00:00.000Z' },
  { handle: 'yaoyaogm', displayName: 'YeFan 叶凡 | 柳神在哪？', followedAgo: '6 days ago', followedAt: '2026-08-05T00:00:00.000Z' },
  { handle: 'robertl83909710', displayName: 'Dr Robertlee 李波', followedAgo: '6 days ago', followedAt: '2026-08-05T12:00:00.000Z' },
  { handle: 'chouchou_tx', displayName: '丑丑TX', followedAgo: '6 days ago', followedAt: '2026-08-05T06:00:00.000Z' },
  { handle: 'xiaofei_btc', displayName: '小飛', followedAgo: '6 days ago', followedAt: '2026-08-05T03:00:00.000Z' },
  { handle: 'xiamu723', displayName: '夏目贵志', followedAgo: '7 days ago', followedAt: '2026-08-04T00:00:00.000Z' },
  { handle: 'stablequan', displayName: 'Quan Nguyen', followedAgo: '14 days ago', followedAt: '2026-07-28T00:00:00.000Z' },
  { handle: 'tuituiweb3', displayName: 'TUTU.图图', followedAgo: 'a month ago', followedAt: '2026-07-11T00:00:00.000Z' },
  { handle: 'qiuseoflove', displayName: '叶知秋', followedAgo: 'a month ago', followedAt: '2026-07-10T00:00:00.000Z' },
  { handle: 'yuguan1209', displayName: '鱼人#鱼馆', followedAgo: 'a month ago', followedAt: '2026-07-09T00:00:00.000Z' },
  { handle: 'tazmancrypto', displayName: 'Tazman', followedAgo: '2 months ago', followedAt: '2026-06-11T00:00:00.000Z' },
  { handle: 'champagneman', displayName: 'MJdata', followedAgo: '2 months ago', followedAt: '2026-06-10T00:00:00.000Z' },
  { handle: 'cryptoarte', displayName: 'CryptoArte', followedAgo: '2 months ago', followedAt: '2026-06-09T00:00:00.000Z' },
  { handle: '0xxiaoxiong', displayName: 'APESister Grace |Gate美股0费率', followedAgo: '2 months ago', followedAt: '2026-06-08T00:00:00.000Z' },
  { handle: '0xkakarot888', displayName: '0x卡卡撸特', followedAgo: '2 months ago', followedAt: '2026-06-07T00:00:00.000Z' },
  { handle: 'blockma', displayName: '区块马', followedAgo: '2 months ago', followedAt: '2026-06-06T00:00:00.000Z' },
  { handle: '0xsophia_baby', displayName: 'Sophia', followedAgo: '2 months ago', followedAt: '2026-06-05T00:00:00.000Z' },
  { handle: 'f0huazzz', displayName: 'FuHua', followedAgo: '2 months ago', followedAt: '2026-06-04T00:00:00.000Z' },
  { handle: '466anan', displayName: 'Crypto Nan', followedAgo: '2 months ago', followedAt: '2026-06-03T00:00:00.000Z' },
  { handle: 'bitcoin188', displayName: '比特币道', followedAgo: '2 months ago', followedAt: '2026-06-02T00:00:00.000Z' },
  { handle: 'jeery314159', displayName: 'Jeery314159 LFG', followedAgo: '2 months ago', followedAt: '2026-06-01T00:00:00.000Z' },
  { handle: 'bitcoin136', displayName: '七喜 | 7UP', followedAgo: '2 months ago', followedAt: '2026-05-31T00:00:00.000Z' },
  { handle: 'laowu3677', displayName: 'Web3老吴', followedAgo: '2 months ago', followedAt: '2026-05-30T00:00:00.000Z' },
  { handle: '0xpipi', displayName: 'Pipi', followedAgo: '2 months ago', followedAt: '2026-05-29T00:00:00.000Z' },
  { handle: 'evans666666', displayName: 'Evans.eth', followedAgo: '2 months ago', followedAt: '2026-05-28T00:00:00.000Z' },
  { handle: 'oceansbaby_', displayName: 'Cruise橘子哥', followedAgo: '2 months ago', followedAt: '2026-05-27T00:00:00.000Z' },
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

  map = { ...map, martinho99999 }
  console.log('Set map.martinho99999 =', martinho99999.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · MartinHo99999 recent followers curated',
    note: 'Update recent followers for @MartinHo99999 (28 accounts)',
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
  const list = v.map?.martinho99999
  console.log(
    'Verify martinho99999:',
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
