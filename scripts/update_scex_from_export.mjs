/**
 * Rebuild SCEX tracking from mention export (actors + original post links).
 * Merges existing media/text by status id. PUT R2 with --put.
 *
 *   node scripts/update_scex_from_export.mjs
 *   node scripts/update_scex_from_export.mjs --put
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
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
    )
      v = v.slice(1, -1)
    if (v && (!process.env[k] || process.env[k] === '')) process.env[k] = v
  }
}
loadEnv('.env.local')
loadEnv('.env.production.local')

const doPut = process.argv.includes('--put')
const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)

/** VN number: 26.800 → 26800, 1.635 → 1635, 51.96 → 51960 when views scale */
function parseNum(raw) {
  if (typeof raw === 'number') return raw
  const s = String(raw || '')
    .replace(/[^\d.,]/g, '')
    .trim()
  if (!s) return 0
  // thousand separator dots: 26.800 or 128.452
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''))
  // views like 51.96 meaning 51,960? export used 51.960 with 3 decimals → already covered
  // 3.641 with 3 digits after last dot = 3641
  if (/^\d+\.\d{3}$/.test(s)) return Number(s.replace('.', ''))
  // plain
  return Number(s.replace(/,/g, '')) || 0
}

function mapTone(tone) {
  const t = String(tone || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (t.includes('bullish') || t.includes('tich cuc')) return 'bullish'
  if (t.includes('bearish') || t.includes('tieu cuc')) return 'bearish'
  if (t.includes('shill')) return 'shill'
  if (t.includes('scam')) return 'scam'
  // Hỗn hợp / Trung lập → neutral (note keeps original)
  return 'neutral'
}

function tierFromFollowers(n) {
  if (n >= 100000) return 'Grandmaster'
  if (n >= 40000) return 'Master'
  if (n >= 20000) return 'Diamond'
  if (n >= 10000) return 'Platinum'
  if (n >= 3000) return 'Challenger'
  return 'Rising'
}

function qualityScore(followers, goc, reply, views) {
  const posts = Math.max(1, goc + reply)
  const viewsPerPost = views / posts
  const er =
    followers > 0
      ? Math.min(1.2, views / (followers * Math.max(1, goc) * 0.35))
      : 0
  let q = 28 + Math.min(42, Math.log10(viewsPerPost + 10) * 14)
  q += Math.min(22, er * 20)
  if (goc >= 5) q += 4
  if (goc >= 9) q += 5
  if (reply >= 10) q += 3
  if (views >= 50000) q += 4
  return Math.round(Math.min(98, Math.max(12, q)))
}

function snowflakeToIso(idStr) {
  try {
    const ms = Number((BigInt(idStr) >> 22n) + 1288834974657n)
    return new Date(ms).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function parseStatusUrls(blob) {
  if (!blob) return []
  const re =
    /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d{5,25})/gi
  const out = []
  const seen = new Set()
  let m
  while ((m = re.exec(String(blob)))) {
    const handle = m[1].toLowerCase()
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      handle,
      statusId: id,
      url: `https://x.com/${m[1]}/status/${id}`,
    })
  }
  return out
}

function computeQuadrant(volume, quality, volumeSplit, qualitySplit) {
  const highVol = volume >= volumeSplit
  const highQ = quality >= qualitySplit
  if (highVol && highQ) return 'stars'
  if (!highVol && highQ) return 'nurture'
  if (highVol && !highQ) return 'noise'
  return 'ignore'
}

/**
 * Full actor export (previous table). followers / goc / reply / views / tone
 * Followers & views use VN thousand-dot notation in source — stored as int here.
 */
const ACTORS_RAW = [
  ['scexofficial', 'SCEX', 2729, 31, 0, 66753, 'Bullish', true],
  ['luong4101992', 'nbaluong', 26800, 11, 62, 60472, 'Hỗn hợp'],
  ['tuannguyen_6789', 'Minhtuan', 71800, 9, 0, 128452, 'Hỗn hợp'],
  ['tcvncommunity', 'TCVN Community', 63300, 7, 0, 51960, 'Hỗn hợp'],
  ['gfiresearch', 'GFI Research', 13000, 7, 0, 3641, 'Hỗn hợp'],
  ['danhtran68', 'danhtran68', 37400, 6, 2, 58126, 'Hỗn hợp'],
  ['solotop999', 'solotop999', 21500, 5, 2, 74827, 'Hỗn hợp'],
  ['phamduydong179', 'phamduydong179', 175200, 5, 1, 40416, 'Bullish'],
  ['trhonbtc', 'trhonbtc', 3711, 5, 0, 1635, 'Hỗn hợp'],
  ['kt_btc', 'KT', 44100, 4, 11, 53384, 'Hỗn hợp'],
  ['shuigvn', 'shuigvn', 18700, 4, 2, 144193, 'Hỗn hợp'],
  ['sucvat65111', 'SucVat65111', 7029, 4, 0, 36153, 'Hỗn hợp'],
  ['bachkhoabnb', 'bachkhoabnb', 47200, 3, 37, 16993, 'Hỗn hợp'],
  ['kiengold', 'KienGold', 9005, 3, 0, 13759, 'Hỗn hợp'],
  ['kieuphong78', 'KieuPhong78', 8249, 3, 0, 5655, 'Hỗn hợp'],
  ['database52hz', 'Database52Hz', 17500, 3, 0, 5600, 'Hỗn hợp'],
  ['mrtrinhcrypto', 'mrtrinhcrypto', 2455, 3, 0, 3640, 'Bullish'],
  ['dungtudau', 'Dungtudau', 7727, 3, 0, 2771, 'Bullish'],
  ['verathai11', 'verathai11', 12500, 3, 0, 1948, 'Hỗn hợp'],
  ['khiembnb', 'KhiemBNB', 5197, 3, 0, 1160, 'Hỗn hợp'],
  ['dinhthang97', 'dinhthang97', 37700, 2, 18, 4180, 'Trung lập'],
  ['blockmedia_vn', 'Blockmedia_vn', 30300, 2, 4, 3944, 'Hỗn hợp'],
  ['kaibgr', 'KaiBGR', 18400, 2, 4, 2806, 'Bullish'],
  ['lensmoso', 'Lens', 32000, 2, 4, 1602, 'Hỗn hợp'],
  ['0xcut555', '0xCut555', 25600, 2, 3, 3428, 'Hỗn hợp'],
  ['qwarm1990', 'QWarm', 28300, 2, 3, 2031, 'Bullish'],
  ['aiadopthq', 'AIAdoptHQ', 26800, 2, 0, 20979, 'Bullish'],
  ['kemphuyen', 'Kemphuyen', 22200, 2, 0, 20873, 'Hỗn hợp'],
  ['quilix', 'quilix', 21400, 2, 0, 19028, 'Hỗn hợp'],
  ['quanm2831', 'quanm2831', 12600, 2, 0, 17596, 'Bullish'],
  ['sera_nie', 'sera_nie', 3610, 2, 0, 15449, 'Hỗn hợp'],
  ['petertran_ct', 'Peter Tran', 41900, 2, 0, 11314, 'Hỗn hợp'],
  ['htp96_community', 'htp96_community', 15900, 2, 0, 4980, 'Hỗn hợp'],
  ['tianthachpp', 'TianThachpp', 3607, 2, 0, 799, 'Hỗn hợp'],
  ['ricefarmernft', 'RiceFarmerNFT', 17100, 2, 0, 759, 'Hỗn hợp'],
  ['thienbtcrypto', 'thienbtcrypto', 812, 2, 0, 728, 'Hỗn hợp'],
  ['trieu6878', 'trieu6878', 5481, 2, 0, 618, 'Hỗn hợp'],
  ['udjat19', 'Udjat', 4338, 2, 0, 590, 'Hỗn hợp'],
  ['jupxeno', 'JupXeno', 3522, 2, 0, 449, 'Bullish'],
  ['aliba_79', 'Aliba_79', 15800, 2, 0, 390, 'Bullish'],
  ['bixunsn18049920', 'BiXunSn18049920', 516, 2, 0, 299, 'Hỗn hợp'],
  ['kenno1r', 'KenNo1r', 2348, 2, 0, 159, 'Hỗn hợp'],
  ['blockhaydotcom', 'blockhaydotcom', 573, 2, 0, 106, 'Trung lập'],
  ['lucasng990', 'Lucas', 16800, 1, 4, 2868, 'Trung lập'],
  ['liquid100x', 'Liquid100x', 29700, 1, 3, 1626, 'Bullish'],
  ['vanquan_titans', 'Vanquan_titans', 60200, 1, 3, 1038, 'Bullish'],
  ['giabao_crypto', 'Gia Bảo', 19600, 1, 3, 965, 'Trung lập'],
  ['leejetjet', 'LEEJETJET', 15200, 1, 2, 3621, 'Bullish'],
  ['tdcryptovn', 'tdcryptovn', 16800, 1, 2, 1972, 'Bullish'],
  ['huevatoi', 'HuevaToi', 19900, 1, 2, 1698, 'Bullish'],
  ['iamnxa', 'iamnxa', 17000, 1, 1, 22912, 'Hỗn hợp'],
  ['thienthien1305', 'Thienthien1305', 52400, 1, 1, 12008, 'Bullish'],
  ['vinhdtrai', 'vinhdtrai', 19100, 1, 1, 4496, 'Hỗn hợp'],
  ['father_monkey92', 'Father_monkey92', 16500, 1, 1, 2142, 'Bullish'],
  ['pigrichh', 'Pig Pig', 28400, 1, 1, 1641, 'Bullish'],
  ['kaisenview', 'Kaisenview', 18000, 1, 1, 1583, 'Hỗn hợp'],
  ['0xkyliekim', '0xkyliekim', 8810, 1, 1, 1491, 'Bullish'],
  ['vanhuuxvietnam', 'Vanhuuxvietnam', 982, 1, 1, 1138, 'Bullish'],
  ['mieweb3', 'MieWeb3', 23800, 1, 1, 996, 'Bullish'],
  ['kenshinc', 'KenshinC', 5739, 1, 1, 707, 'Trung lập'],
  ['trong_hatachi', 'Trong_Hatachi', 13200, 1, 1, 125, 'Bullish'],
  ['gf_capital', 'GF Capital', 146000, 1, 0, 11094, 'Bullish'],
  ['bicantho', 'BiCanTho', 65099, 1, 0, 8644, 'Bullish'],
  ['thanhcryptobnb', 'ThanhCryptoBnb', 55800, 1, 0, 6593, 'Bullish'],
  ['nickypham_hc', 'NickyPham_HC', 335200, 1, 0, 5941, 'Bullish'],
  ['vanmei', 'Vanmei', 7546, 1, 0, 5793, 'Trung lập'],
  ['chanhdoro', 'chanhdoro', 17500, 1, 0, 5319, 'Hỗn hợp'],
  ['tradealot_', 'TradeALot_', 4263, 1, 0, 5102, 'Bullish'],
  ['tran_today', 'Tran_Today', 14900, 1, 0, 4430, 'Bullish'],
  ['sangbtcethxau', 'Sang.BTC', 18500, 1, 0, 4421, 'Bearish'],
  ['trimaims', 'TriMaiMS', 84000, 1, 0, 4386, 'Hỗn hợp'],
  ['dohhanx', 'dohhanx', 1475, 1, 0, 2769, 'Bullish'],
  ['mobx134', 'MobX134', 12900, 1, 0, 2619, 'Hỗn hợp'],
  ['hongmyresearch', 'hongmyresearch', 4515, 1, 0, 2283, 'Bullish'],
  ['seven_nguyen666', 'Seven_Nguyen666', 24900, 1, 0, 2090, 'Trung lập'],
  ['rightrh', 'RightRH', 7316, 1, 0, 1945, 'Bullish'],
  ['kyanh6789', 'KyAnh6789', 3030, 1, 0, 1838, 'Bullish'],
  ['lokilaw_nld', 'Lokilaw_NLD', 5662, 1, 0, 1797, 'Bullish'],
  ['luongson94', 'Luongson94', 21200, 1, 0, 1663, 'Bullish'],
  ['ritaxfinance', 'RitaXFinance', 15400, 1, 0, 1647, 'Bullish'],
  ['vangemxin1', 'vangemxin1', 2224, 1, 0, 1393, 'Trung lập'],
  ['tranninh9', 'TranNinh9', 438, 1, 0, 1263, 'Bullish'],
  ['crypto181199', 'Crypto181199', 8169, 1, 0, 1164, 'Trung lập'],
  ['v_3394', 'v_3394', 9948, 1, 0, 1154, 'Trung lập'],
  ['ghostxwriterx', 'GhostxWriterx', 5404, 1, 0, 1040, 'Hỗn hợp'],
  ['maybach_eth', 'maybach_eth', 19800, 1, 0, 1027, 'Hỗn hợp'],
  ['charlotte951231', 'Charlotte951231', 2625, 1, 0, 993, 'Bullish'],
  ['sushi1426', 'sushi1426', 6373, 1, 0, 937, 'Trung lập'],
  ['tuongvi_vn', 'TuongVi_VN', 5198, 1, 0, 895, 'Bullish'],
  ['tesnguyeneth', 'tesnguyeneth', 9402, 1, 0, 873, 'Bullish'],
  ['mr_mmon', 'mr_mmon', 2914, 1, 0, 855, 'Hỗn hợp'],
  ['cuong2591442657', 'Cuong2591442657', 3503, 1, 0, 788, 'Bullish'],
  ['0xpain__', '0xPain', 7235, 1, 0, 690, 'Bullish'],
  ['thinhcrt', 'ThinhCrt', 3082, 1, 0, 674, 'Trung lập'],
  ['trungdino90', 'Trungdino90', 9558, 1, 0, 662, 'Bullish'],
  ['dntthi', 'DntThi', 7200, 1, 0, 582, 'Bullish'],
  ['ptginking', 'PTGinKing', 17800, 1, 0, 563, 'Trung lập'],
  ['realfrontierx', 'RealFrontierX', 3026, 1, 0, 552, 'Trung lập'],
  ['cavana_eth', 'Cavana_eth', 5087, 1, 0, 509, 'Trung lập'],
  ['thangha19931991', 'thangha19931991', 7731, 1, 0, 410, 'Trung lập'],
  ['vietnamvba', 'VietnamVBA', 1240, 1, 0, 332, 'Trung lập'],
  ['gynis_tao', 'Noat', 7568, 1, 0, 327, 'Bullish'],
  ['trong_ga29814', 'trong_ga29814', 3126, 1, 0, 274, 'Hỗn hợp'],
  ['bem1102', 'bem1102', 1093, 1, 0, 272, 'Bullish'],
  ['cocoteamvnn', 'COCOteamvnn', 1203, 1, 0, 243, 'Bullish'],
  ['deekay_btc', 'deekay_btc', 7176, 1, 0, 243, 'Bullish'],
  ['naomi_mcrn', 'naomi_mcrn', 924, 1, 0, 239, 'Trung lập'],
  ['tungthuocno', 'Tungthuocno', 1769, 1, 0, 238, 'Bullish'],
  ['anhvu193', 'anhvu193', 4343, 1, 0, 215, 'Bullish'],
  ['vietnambackcom', 'Vietnambackcom', 92, 1, 0, 210, 'Bullish'],
  ['anhdii72', 'Anhdii72', 2979, 1, 0, 209, 'Bullish'],
  ['jasonblockchain', 'jasonblockchain', 5518, 1, 0, 209, 'Trung lập'],
  ['phwquynh01', 'PhwQuynh01', 1730, 1, 0, 205, 'Trung lập'],
  ['hungtinh1993', 'HungTinh1993', 9056, 1, 0, 203, 'Bullish'],
  ['alancipher43', 'alancipher43', 1645, 1, 0, 191, 'Trung lập'],
  ['tannnnnnn2022', 'Tannnnnnn2022', 12400, 1, 0, 172, 'Trung lập'],
  ['digittrad2407', 'DigitTrad2407', 17100, 1, 0, 151, 'Trung lập'],
  ['daveynftsai', 'DaveyNFTsAI', 2500, 1, 0, 148, 'Bullish'],
  ['nick_htlc', 'Nick_HTLC', 4400, 1, 0, 135, 'Trung lập'],
  ['luugian95257476', 'LuuGian95257476', 3054, 1, 0, 123, 'Bullish'],
  ['vninvestblogger', 'Brian Truong', 4333, 1, 0, 116, 'Bullish'],
  ['valuespreading', 'valuespreading', 1706, 1, 0, 115, 'Bullish'],
  ['datmindchart', 'datmindchart', 1525, 1, 0, 113, 'Bullish'],
  ['wendyr9_', 'wendyr9_', 6018, 1, 0, 111, 'Bullish'],
  ['bigknivess', 'Bigknives', 1302, 1, 0, 99, 'Bullish'],
  ['sna2499', 'Sna2499', 1580, 1, 0, 93, 'Trung lập'],
  ['nguyent17504220', 'NguyenT17504220', 1928, 1, 0, 89, 'Bullish'],
  ['bovabi38', 'BovaBi38', 4405, 1, 0, 80, 'Bullish'],
  ['hang1856', 'hang1856', 965, 1, 0, 68, 'Bearish'],
  ['chikoevm', 'chikoevm', 5659, 1, 0, 63, 'Hỗn hợp'],
  ['heanutie', 'heanutie', 2556, 1, 0, 52, 'Bullish'],
  ['validator247', 'Validator247', 1666, 1, 0, 52, 'Bullish'],
  ['gaming1_nh', 'gaming1_nh', 1655, 1, 0, 50, 'Bullish'],
  ['panxuanthang5', 'PanXuanThang5', 1616, 1, 0, 48, 'Trung lập'],
]

/** Original post link blobs (status URLs) by handle — from latest export */
const LINKS_BY_HANDLE = {
  luong4101992: `
https://x.com/luong4101992/status/2072138748968800660
https://x.com/luong4101992/status/2072161773147574505
https://x.com/luong4101992/status/2072325647100428595
https://x.com/luong4101992/status/2072534765870485509
https://x.com/luong4101992/status/2072862772526981279
https://x.com/luong4101992/status/2072870996529586373
https://x.com/luong4101992/status/2074698225517474147
https://x.com/luong4101992/status/2075483551882154488
https://x.com/luong4101992/status/2078322776012943711
https://x.com/luong4101992/status/2078340123184488529
https://x.com/luong4101992/status/2079764123051860016
`,
  tuannguyen_6789: `
https://x.com/TuanNguyen_6789/status/2071951890745602141
https://x.com/TuanNguyen_6789/status/2071973046374854807
https://x.com/TuanNguyen_6789/status/2072087315879698731
https://x.com/TuanNguyen_6789/status/2072231253215252721
https://x.com/TuanNguyen_6789/status/2074061706091786703
https://x.com/TuanNguyen_6789/status/2074366299153826243
https://x.com/TuanNguyen_6789/status/2074477185424031770
https://x.com/TuanNguyen_6789/status/2075068928771129848
https://x.com/TuanNguyen_6789/status/2076914937784668529
`,
  tcvncommunity: `
https://x.com/TCVNcommunity/status/2071869726461202471
https://x.com/TCVNcommunity/status/2071897215489192216
https://x.com/TCVNcommunity/status/2072136234206699939
https://x.com/TCVNcommunity/status/2072307643293798485
https://x.com/TCVNcommunity/status/2073348126912733218
https://x.com/TCVNcommunity/status/2073954773464985865
https://x.com/TCVNcommunity/status/2073984878610423862
`,
  gfiresearch: `
https://x.com/GFIResearch/status/2071978870178549792
https://x.com/GFIResearch/status/2072892782231097467
https://x.com/GFIResearch/status/2073301264637808831
https://x.com/GFIResearch/status/2073595098378756607
https://x.com/GFIResearch/status/2073984540251766886
https://x.com/GFIResearch/status/2077957089536958839
https://x.com/GFIResearch/status/2078063286218829904
`,
  danhtran68: `
https://x.com/danhtran68/status/2072256370859299195
https://x.com/danhtran68/status/2072505496691761569
https://x.com/danhtran68/status/2072512652518338616
https://x.com/danhtran68/status/2072583880117510268
https://x.com/danhtran68/status/2072873885691961811
https://x.com/danhtran68/status/2073285715312713732
`,
  solotop999: `
https://x.com/solotop999/status/2072219666605560229
https://x.com/solotop999/status/2072220178642038877
https://x.com/solotop999/status/2072506763203719659
https://x.com/solotop999/status/2074027448065577446
https://x.com/solotop999/status/2075128056252190833
`,
  phamduydong179: `
https://x.com/phamduydong179/status/2071970324879696280
https://x.com/phamduydong179/status/2072607094684225835
https://x.com/phamduydong179/status/2073074287440019755
https://x.com/phamduydong179/status/2076607577144922566
https://x.com/phamduydong179/status/2079053685733175571
`,
  trhonbtc: `
https://x.com/trhonbtc/status/2071846437663764865
https://x.com/trhonbtc/status/2072640553003692179
https://x.com/trhonbtc/status/2072903893781291517
https://x.com/trhonbtc/status/2074471171945578859
https://x.com/trhonbtc/status/2074496572407292173
`,
}

// Load previous seed for media merge
const prevPath = path.join(ROOT, 'src/data/internal/scex-tracking.json')
const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'))
const prevPostById = new Map()
for (const p of prev.posts || []) {
  const id = String(p.id || '').replace(/^p_/, '')
  if (id) prevPostById.set(id, p)
  // also by url status id
  const m = String(p.url || '').match(/status\/(\d{5,25})/i)
  if (m) prevPostById.set(m[1], p)
}

const volumeSplit = 3
const qualitySplit = 50
const volumeAxisMax = 20

const actors = []
const posts = []
const postIds = new Set()

for (const row of ACTORS_RAW) {
  const [handle, displayName, followers, goc, reply, views, tone, isBrand] =
    row
  const h = handle.toLowerCase()
  const sent = mapTone(tone)
  const totalVol = goc + reply
  const q = qualityScore(followers, goc, reply, views)

  if (!isBrand) {
    actors.push({
      id: `a_${h}`,
      handle: h,
      displayName,
      kind: followers >= 3000 || totalVol >= 2 ? 'kol' : 'user',
      tier: tierFromFollowers(followers),
      followers,
      reach7d: views,
      postsVolume: totalVol,
      qualityScore: q,
      sentiment: sent,
      sentimentConfidence:
        tone === 'Hỗn hợp' ? 0.55 : tone === 'Trung lập' ? 0.65 : 0.8,
      quadrant: computeQuadrant(totalVol, q, volumeSplit, qualitySplit),
      isWhitelisted: followers >= 10000 || totalVol >= 3,
      notes: `Gốc ${goc} · Reply ${reply} · Views ${views.toLocaleString('en-US')} · Tone: ${tone}`,
      lastPostAt: undefined,
      tags: [
        `goc:${goc}`,
        `reply:${reply}`,
        tone === 'Hỗn hợp' ? 'mixed' : sent,
      ].join(','),
    })
  }

  // Posts from link export
  const links = parseStatusUrls(LINKS_BY_HANDLE[h] || '')
  for (const L of links) {
    if (postIds.has(L.statusId)) continue
    postIds.add(L.statusId)
    const prevP = prevPostById.get(L.statusId)
    posts.push({
      id: `p_${L.statusId}`,
      handle: L.handle,
      url: L.url,
      text:
        prevP?.text ||
        `@${L.handle} · mention SCEX (export gốc) · tone ${tone}`,
      postedAt: prevP?.postedAt || snowflakeToIso(L.statusId),
      sentiment: prevP?.sentiment || sent,
      likes: prevP?.likes,
      replies: prevP?.replies,
      reposts: prevP?.reposts,
      views: prevP?.views,
      media: prevP?.media?.length ? prevP.media : undefined,
      hidden: false,
      notes: prevP?.notes || `export · ${tone}`,
    })
  }
}

// Keep previous posts whose handle is still in actor set or brand
const actorHandles = new Set(actors.map((a) => a.handle))
actorHandles.add('scexofficial')
for (const p of prev.posts || []) {
  const sid = String(p.url || '').match(/status\/(\d{5,25})/i)?.[1]
  if (sid && postIds.has(sid)) continue
  const h = String(p.handle || '').toLowerCase()
  if (!actorHandles.has(h)) continue
  if (sid) postIds.add(sid)
  posts.push({
    ...p,
    handle: h,
    id: p.id || (sid ? `p_${sid}` : p.id),
  })
}

// lastPostAt from posts
const lastByHandle = new Map()
for (const p of posts) {
  const t = p.postedAt || ''
  const h = p.handle
  if (!lastByHandle.has(h) || t > lastByHandle.get(h)) lastByHandle.set(h, t)
}
for (const a of actors) {
  if (lastByHandle.has(a.handle)) a.lastPostAt = lastByHandle.get(a.handle)
}

actors.sort((a, b) => {
  if (b.postsVolume !== a.postsVolume) return b.postsVolume - a.postsVolume
  return b.followers - a.followers
})
posts.sort(
  (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
)

const maxVol = Math.max(...actors.map((a) => a.postsVolume), 8)
const now = new Date().toISOString()

const dataset = {
  version: 1,
  kind: 'scex-tracking',
  asOf: '2026-07-23T18:00:00.000Z',
  updatedAt: now,
  note: `SCEX mention export sync · ${actors.length} accounts · ${posts.length} original posts linked · matrix volume = gốc+reply · views → reach7d. Livefeed filter by KOL. Tone Hỗn hợp/Trung lập → neutral.`,
  config: {
    ...(prev.config || {}),
    brandName: 'SCEX',
    brandHandle: 'scexofficial',
    timeWindowDays: 30,
    kolMinPosts: 1,
    userMinPosts: 1,
    userMinFollowers: 500,
    userMinQuality: 12,
    volumeAxis: {
      min: 0,
      max: Math.max(volumeAxisMax, Math.ceil(maxVol * 1.05)),
      label: 'Tần suất mention (gốc + reply)',
    },
    qualityAxis: {
      min: 0,
      max: 100,
      label: 'Điểm chất lượng (views / reach)',
    },
    sizeMetric: 'followers',
    volumeSplit,
    qualitySplit,
    matrixTitle: 'Ma trận mention SCEX',
    feedTitle: 'Bảng tin mention · SCEX',
    enabled: true,
    quadrantLabels: prev.config?.quadrantLabels || {
      stars: {
        title: 'TRỌNG ĐIỂM',
        subtitle: 'Tần suất cao · chất lượng cao — ưu tiên theo dõi',
      },
      nurture: {
        title: 'TIỀM NĂNG',
        subtitle: 'Chất lượng cao · tần suất thấp — khuyến khích tương tác',
      },
      noise: {
        title: 'CẦN RÀ SOÁT',
        subtitle: 'Tần suất cao · chất lượng thấp — lọc và đánh giá lại',
      },
      ignore: {
        title: 'TÍN HIỆU YẾU',
        subtitle: 'Tần suất thấp · chất lượng thấp — không ưu tiên',
      },
    },
    sentimentLabels: prev.config?.sentimentLabels || {
      bullish: { label: 'Tích cực', color: '#22c55e' },
      bearish: { label: 'Tiêu cực', color: '#ef4444' },
      shill: { label: 'Shill', color: '#f59e0b' },
      scam: { label: 'Cảnh báo scam', color: '#dc2626' },
      neutral: { label: 'Trung lập', color: '#94a3b8' },
    },
    keywords: prev.config?.keywords || [
      'SCEX',
      '@scexofficial',
      'scexofficial',
      '#SCEX',
      '#SCEXSimulator',
    ],
  },
  actors,
  posts,
}

const seedPaths = [
  path.join(ROOT, 'src/data/internal/scex-tracking.json'),
  path.join(ROOT, 'data/internal/scex-tracking.json'),
]
const json = JSON.stringify(dataset, null, 2) + '\n'
for (const p of seedPaths) {
  fs.writeFileSync(p, json, 'utf8')
  console.log('wrote', p)
}

const quads = {}
for (const a of actors) quads[a.quadrant] = (quads[a.quadrant] || 0) + 1
const sents = {}
for (const a of actors) sents[a.sentiment] = (sents[a.sentiment] || 0) + 1

console.log(
  JSON.stringify(
    {
      actors: actors.length,
      posts: posts.length,
      postsWithMedia: posts.filter((p) => p.media?.length).length,
      volumeMax: dataset.config.volumeAxis.max,
      volumeSplit,
      quadrants: quads,
      sentiments: sents,
      top: actors.slice(0, 8).map((a) => ({
        h: a.handle,
        v: a.postsVolume,
        q: a.qualityScore,
        f: a.followers,
        s: a.sentiment,
        quad: a.quadrant,
      })),
    },
    null,
    2,
  ),
)

if (doPut) {
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }
  const putRes = await fetch(`${base}/api/scex-tracking`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dataset),
  })
  console.log('PUT', putRes.status, (await putRes.text()).slice(0, 280))
  if (!putRes.ok) process.exit(1)
  const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
  const got = await getRes.json()
  console.log('GET', {
    actors: got.actors?.length,
    posts: got.posts?.length,
    volumeMax: got.config?.volumeAxis?.max,
  })
}
