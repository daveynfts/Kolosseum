/**
 * Merge @henvaibta smart followers into R2 recent-followers/v1.json via API.
 *
 *   node scripts/push_henvaibta_smart_followers.mjs
 *
 * Needs FEED_ADMIN_TOKEN in .env.local (or env).
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

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

  // Load curated list from seed
  const seedUrl = pathToFileURL(
    path.join(ROOT, 'src/data/recentFollowers.ts'),
  ).href
  // Can't import TS directly — hardcode path via dynamic read of compiled list
  // by evaluating a tiny JSON export: re-parse SMART block is fragile.
  // Instead import from a JSON snapshot we write from seed, or duplicate the array.

  const henvaibta = [
    {
      handle: 'NickyPham_HC',
      displayName: 'Nicky Pham',
      role: 'Tier A · Đồng sáng lập AlphaBack; crypto, trading, airdrop. Network lớn tại Việt Nam; cần lưu ý mô hình affiliate/hoàn phí',
      followers: 335089,
      influenceScore: 900,
    },
    {
      handle: 'TNC404',
      displayName: 'TNC404',
      role: 'Tier A · Tài khoản thị trường/crypto từ 2016. Lâu năm, chỉ theo dõi 18 tài khoản; độ nổi bật cao nhưng bio không chứng minh chuyên môn cụ thể',
      followers: 135804,
      influenceScore: 880,
    },
    {
      handle: 'TCVNcommunity',
      displayName: 'TradeCoinVN Community',
      role: 'Tier A · Cộng đồng TradeCoinVN. Smart network/media account, không phải một trader cá nhân',
      followers: 63327,
      influenceScore: 860,
    },
    {
      handle: 'hanjiahnn',
      displayName: 'Hanjiahnn',
      role: 'Tier A · Trader, holder crypto và hàng hóa; founder TWH Group. Chuyên môn thị trường thể hiện rõ; chưa có PnL kiểm toán công khai',
      followers: 52442,
      influenceScore: 840,
    },
    {
      handle: 'ShengMo0x',
      displayName: 'ShengMo',
      role: 'Tier A · Crypto từ 2013, mining, Bitcoin ecosystem. Hồ sơ lâu năm và ngách chuyên môn tương đối rõ',
      followers: 49581,
      influenceScore: 820,
    },
    {
      handle: 'LuckyStudent02',
      displayName: 'Lucky Student',
      role: 'Tier A · Nội dung trading, quản lý vốn và tâm lý giao dịch. Có cộng đồng riêng; nên xem là trading educator/KOL, không mặc định là smart money',
      followers: 45040,
      influenceScore: 800,
    },
    {
      handle: 'immihu',
      displayName: 'immihu',
      role: 'Tier B · Web3 builder; HCMC Blockchain Association; từng ở AmberBlocks. Có yếu tố builder và hệ sinh thái; giá trị nằm ở network hơn là dự báo giá',
      followers: 27970,
      influenceScore: 520,
    },
    {
      handle: 'Tnubmv',
      displayName: 'Tnubmv',
      role: 'Tier B · Tài khoản giao dịch crypto. Tỷ lệ follower/following tốt nhưng bio quá mỏng, chưa đủ dữ liệu xếp Tier A',
      followers: 25014,
      influenceScore: 500,
    },
    {
      handle: 'Airdrop_CSGroup',
      displayName: 'Airdrop CS Group',
      role: 'Tier B · Cộng đồng trading, news và airdrop. Có độ phủ cộng đồng nhưng thiên về phân phối nội dung',
      followers: 23034,
      influenceScore: 480,
    },
  ]

  console.log('GET', `${apiBase}/api/recent-followers`)
  const getRes = await fetch(`${apiBase}/api/recent-followers?t=${Date.now()}`)
  let map = {}
  let smartMap = {}
  let prevUpdated = null

  if (getRes.ok) {
    const body = await getRes.json()
    map = body.map && typeof body.map === 'object' ? body.map : {}
    smartMap =
      body.smartMap && typeof body.smartMap === 'object' ? body.smartMap : {}
    prevUpdated = body.updatedAt || null
    console.log(
      'Server OK · map keys:',
      Object.keys(map).length,
      '· smartMap keys:',
      Object.keys(smartMap).length,
      '· prev updatedAt:',
      prevUpdated,
    )
  } else if (getRes.status === 404) {
    console.log('Server empty (404) — will create payload with map {}')
  } else {
    const t = await getRes.text()
    console.error('GET failed', getRes.status, t.slice(0, 400))
    process.exit(1)
  }

  smartMap = { ...smartMap, henvaibta }
  console.log('Set smartMap.henvaibta =', henvaibta.length, 'accounts')

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'admin server · henvaibta smart followers curated',
    note: 'Update smart followers for @henvaibta (Tier A/B review)',
    count: Object.keys(map).length,
    map,
    smartMap,
  }

  console.log('PUT', `${apiBase}/api/recent-followers`)
  const putRes = await adminPutJson(`${apiBase}/api/recent-followers`, token, payload)
  const putBody = await putRes.json().catch(() => ({}))
  if (!putRes.ok) {
    console.error('PUT failed', putRes.status, putBody)
    process.exit(1)
  }
  console.log('PUT OK', putBody)

  // Verify
  const verify = await fetch(`${apiBase}/api/recent-followers?t=${Date.now()}`)
  const v = await verify.json()
  const list = v.smartMap?.henvaibta
  console.log(
    'Verify henvaibta:',
    Array.isArray(list) ? list.length + ' smart followers' : 'MISSING',
  )
  if (Array.isArray(list)) {
    console.log(list.map((x) => `@${x.handle}`).join(', '))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
