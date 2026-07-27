/**
 * Merge @Thienthien1305 smart followers into R2 recent-followers/v1.json.
 *
 *   node scripts/push_thienthien1305_smart_followers.mjs
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

const thienthien1305 = [
  {
    handle: 'calchulus',
    displayName: 'Calchulus',
    role: 'Mạnh nhất · Impossible Finance; từng làm tại Binance Research (2018–2021). Follow đã 4 năm, có nền tảng research/operator thực — nhưng follow ~18K nên độ chọn lọc không quá cao',
    influenceScore: 900,
  },
  {
    handle: 'xkonjin',
    displayName: 'xkonjin',
    role: 'Mạnh · Marketing tại Plasma; viết về stablecoin, privacy và machine intelligence. Đúng ngách infra crypto; điểm trừ: follow mới ~4 tháng và following khá rộng',
    influenceScore: 860,
  },
  {
    handle: 'paradex',
    displayName: 'Paradex',
    role: 'Mạnh (thương hiệu) · Tài khoản chính thức futures/options. Mutual + following thấp là tín hiệu tốt; có thể follow vì BD/community hơn đánh giá cá nhân',
    influenceScore: 820,
  },
  {
    handle: 'jampzey',
    displayName: 'Jampzey',
    role: 'Khá · Crypto creator/operator, liên quan R3ACH Network. Mạng lưới lớn, follow ~1 năm — nhưng follow gần 10K nên không nên xem là endorsement đặc biệt',
    influenceScore: 720,
  },
  {
    handle: 'wolfyxbt',
    displayName: 'WolfyXBT',
    role: 'Trung bình–khá · KOL crypto tiếng Trung (trading/meme, CHILABS). 856K followers + mutual là điểm cộng; nội dung đại chúng/quảng bá và following hàng nghìn',
    followers: 856000,
    influenceScore: 650,
  },
  {
    handle: 'yuyue_chris',
    displayName: 'Yuyue Chris',
    role: 'Trung bình–khá · Angel investor; nội dung AI, crypto và trading. Có độ liên quan nhưng hồ sơ công khai chưa đủ để coi là endorsement đầu tư/research trọng lượng cao',
    influenceScore: 620,
  },
  {
    handle: 'darcydonavan',
    displayName: 'Darcy Donavan',
    role: 'Yếu · Diễn viên/nghệ sĩ/doanh nhân, có liên hệ NFT — không phải research crypto cốt lõi; follow ~88K nên chọn lọc rất thấp',
    influenceScore: 380,
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
    console.log('Server empty — creating new maps')
  } else {
    console.error('GET failed', getRes.status, await getRes.text())
    process.exit(1)
  }

  smartMap = { ...smartMap, thienthien1305 }
  console.log('Set smartMap.thienthien1305 =', thienthien1305.length)

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · Thienthien1305 smart followers curated',
    note: 'Update smart followers for @Thienthien1305 (signal review)',
    count: Object.keys(map).length,
    map,
    smartMap,
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
  const list = v.smartMap?.thienthien1305
  console.log(
    'Verify thienthien1305 smart:',
    Array.isArray(list) ? list.length + ' accounts' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(
      list
        .map((x) => `@${x.handle} (${x.influenceScore ?? '—'})`)
        .join(', '),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
