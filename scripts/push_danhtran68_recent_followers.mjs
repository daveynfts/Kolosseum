/**
 * Merge @danhtran68 recent followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_danhtran68_recent_followers.mjs
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

const danhtran68 = [
  {
    handle: 'chouchou_tx',
    displayName: '丑丑TX',
    followedAgo: '12 days ago',
    followedAt: '2026-07-30T00:00:00.000Z',
  },
  {
    handle: 'leonzr1394',
    displayName: '蟾哥TermMax',
    followedAgo: '12 days ago',
    followedAt: '2026-07-29T00:00:00.000Z',
  },
  {
    handle: 'qiuseoflove',
    displayName: '叶知秋',
    followedAgo: '16 days ago',
    followedAt: '2026-07-26T00:00:00.000Z',
  },
  {
    handle: 'gustan0119',
    displayName: 'Gus Tan',
    followedAgo: '21 days ago',
    followedAt: '2026-07-21T00:00:00.000Z',
  },
  {
    handle: 'web3xwg',
    displayName: '小伍哥 | Gate 美股0费率',
    followedAgo: 'a month ago',
    followedAt: '2026-07-11T00:00:00.000Z',
  },
  {
    handle: 'wongwangwung',
    displayName: 'pallase',
    followedAgo: '2 months ago',
    followedAt: '2026-06-11T00:00:00.000Z',
  },
  {
    handle: 'drdavecoin',
    displayName: 'drdavecoin.eth',
    followedAgo: '2 months ago',
    followedAt: '2026-06-10T00:00:00.000Z',
  },
  {
    handle: 'sunnymq1',
    displayName: 'Sunny Tang',
    followedAgo: '2 months ago',
    followedAt: '2026-06-09T00:00:00.000Z',
  },
  {
    handle: 'jasonmdesimone',
    displayName: 'Jason Desimone ⚔️',
    followedAgo: '2 months ago',
    followedAt: '2026-06-08T00:00:00.000Z',
  },
  {
    handle: 'steam_diary123',
    displayName: '区块链日记 ｜TermMax｜买美股上WEEX',
    followedAgo: '3 months ago',
    followedAt: '2026-05-11T00:00:00.000Z',
  },
  {
    handle: 'btc99m',
    displayName: 'Dylan.迪伦丨 买美股上WEEXTermMax',
    followedAgo: '3 months ago',
    followedAt: '2026-05-10T00:00:00.000Z',
  },
  {
    handle: 'lijiaoshou12',
    displayName: '陈较瘦｜TermMax',
    followedAgo: '3 months ago',
    followedAt: '2026-05-09T00:00:00.000Z',
  },
  {
    handle: 'kinglong66666',
    displayName: 'king long',
    followedAgo: '3 months ago',
    followedAt: '2026-05-08T00:00:00.000Z',
  },
  {
    handle: 'evans666666',
    displayName: 'Evans.eth',
    followedAgo: '4 months ago',
    followedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    handle: '0xsexybanana',
    displayName: '郡主Christine (✱,✱)',
    followedAgo: '4 months ago',
    followedAt: '2026-04-10T00:00:00.000Z',
  },
  {
    handle: 'airdropalchemis',
    displayName: '炼金叔叔',
    followedAgo: '5 months ago',
    followedAt: '2026-03-11T00:00:00.000Z',
  },
  {
    handle: 'affinity_matrix',
    displayName: 'Akasha ★',
    followedAgo: '5 months ago',
    followedAt: '2026-03-10T00:00:00.000Z',
  },
  {
    handle: 'minhxdynasty',
    displayName: 'minhxdynasty',
    followedAgo: '6 months ago',
    followedAt: '2026-02-11T00:00:00.000Z',
  },
  {
    handle: 'nateliason',
    displayName: 'Nat Eliason',
    followedAgo: '6 months ago',
    followedAt: '2026-02-10T00:00:00.000Z',
  },
  {
    handle: 'camolnft',
    displayName: 'camol',
    followedAgo: '8 months ago',
    followedAt: '2025-12-11T00:00:00.000Z',
  },
  {
    handle: 'wallchain',
    displayName: 'Wallchain Quacks',
    followedAgo: '8 months ago',
    followedAt: '2025-12-10T00:00:00.000Z',
  },
  {
    handle: 'xiaoniu6161',
    displayName: '小牛',
    followedAgo: '9 months ago',
    followedAt: '2025-11-11T00:00:00.000Z',
  },
  {
    handle: 'xiaofeilong99',
    displayName: '币天天',
    followedAgo: 'a year ago',
    followedAt: '2025-08-11T00:00:00.000Z',
  },
  {
    handle: 'feifan7686',
    displayName: '飞凡',
    followedAgo: 'a year ago',
    followedAt: '2025-08-10T00:00:00.000Z',
  },
  {
    handle: 'lovecity0088',
    displayName: '人在币圈（Lovecity） (小爱)./',
    followedAgo: 'a year ago',
    followedAt: '2025-08-09T00:00:00.000Z',
  },
  {
    handle: 'taojukfc',
    displayName: '桃川',
    followedAgo: 'a year ago',
    followedAt: '2025-08-08T00:00:00.000Z',
  },
  {
    handle: 'huijiu68',
    displayName: '小灰韭',
    followedAgo: 'a year ago',
    followedAt: '2025-08-07T00:00:00.000Z',
  },
  {
    handle: 'boa1314666',
    displayName: 'Boa宝儿',
    followedAgo: 'a year ago',
    followedAt: '2025-08-06T00:00:00.000Z',
  },
  {
    handle: 'btc100000015252',
    displayName: '加密贝姐LK',
    followedAgo: 'a year ago',
    followedAt: '2025-08-05T00:00:00.000Z',
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

  map = { ...map, danhtran68 }
  console.log('Set map.danhtran68 =', danhtran68.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · danhtran68 recent followers curated',
    note: 'Update recent followers for @danhtran68 (29 accounts: chouchou_tx … btc100000015252)',
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
  const list = v.map?.danhtran68
  console.log(
    'Verify danhtran68:',
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
