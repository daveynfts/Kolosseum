/**
 * Build SCEX tracking snapshot from expanded Blue Verified mention list
 * (23/06/2026 – 23/07/2026), write seed JSON, optionally PUT R2 + warm avatars.
 *
 *   node scripts/build_scex_expanded_snapshot.mjs
 *   node scripts/build_scex_expanded_snapshot.mjs --put
 *   node scripts/build_scex_expanded_snapshot.mjs --put --warm
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
const doWarm = process.argv.includes('--warm')
const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
const base = (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
  /\/$/,
  '',
)

/** Twitter snowflake → ISO */
function snowflakeToIso(idStr) {
  try {
    const ms = Number((BigInt(idStr) >> 22n) + 1288834974657n)
    return new Date(ms).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function mapSentiment(raw) {
  const s = String(raw || 'neutral').toLowerCase().trim()
  if (s === 'bullish') return 'bullish'
  if (s === 'bearish' || s === 'mild bearish' || s === 'mild_bearish') return 'bearish'
  if (s === 'shill') return 'shill'
  if (s === 'scam') return 'scam'
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

/**
 * Expanded Blue Verified mention table (STT 1–38).
 * mild_bearish → bearish in schema; notes keep mild_bearish tag.
 */
const RAW_POSTS = [
  {
    stt: 1,
    handle: 'scexofficial',
    displayName: 'SCEX',
    followers: 2700,
    statusId: '2080123242954850748',
    text: 'Tổng kết 2 tuần Đấu trường: 50K+ ĐK, 195K+ lệnh, 81K+ tỷ volume. Kêu gọi tham gia.',
    sentiment: 'Bullish',
    isBrand: true,
  },
  {
    stt: 2,
    handle: 'scexofficial',
    displayName: 'SCEX',
    followers: 2700,
    statusId: '2079508007029981362',
    text: 'Công bố BXH Tuần 2 + kêu gọi Tuần 3 (giải >1.6 tỷ).',
    sentiment: 'Bullish',
    isBrand: true,
  },
  {
    stt: 3,
    handle: 'scexofficial',
    displayName: 'SCEX',
    followers: 2700,
    statusId: '2079045578311467483',
    text: 'Thông báo Tuần 3 Đấu trường bắt đầu.',
    sentiment: 'Bullish',
    isBrand: true,
  },
  {
    stt: 4,
    handle: 'scexofficial',
    displayName: 'SCEX',
    followers: 2700,
    statusId: '2078335348564971972',
    text: 'Có mặt tại Vietnam RWA Summit 2026, tặng quà.',
    sentiment: 'Bullish',
    isBrand: true,
  },
  {
    stt: 5,
    handle: 'scexofficial',
    displayName: 'SCEX',
    followers: 2700,
    statusId: '2078664190823408001',
    text: 'Minigame dự đoán World Cup + quà >30 triệu.',
    sentiment: 'Bullish',
    isBrand: true,
  },
  {
    stt: 6,
    handle: 'scexofficial',
    displayName: 'SCEX',
    followers: 2700,
    statusId: '2078775666984800456',
    text: 'Nhắc ngày cuối Tuần 2 + mở Tuần 3.',
    sentiment: 'Bullish',
    isBrand: true,
  },
  {
    stt: 7,
    handle: 'luong4101992',
    displayName: 'nbaluong',
    followers: 26800,
    statusId: '2079764123051860016',
    text: 'Khen booth SCEX tại RWA, khuyến khích lên tàu sớm + share ref giải thưởng lớn.',
    sentiment: 'Bullish',
  },
  {
    stt: 8,
    handle: 'luong4101992',
    displayName: 'nbaluong',
    followers: 26800,
    statusId: '2078340123184488529',
    text: 'Quan sát sự kiện RWA, tin blockchain VN sẽ về sàn nội địa.',
    sentiment: 'Bullish',
  },
  {
    stt: 9,
    handle: 'dinhthang97',
    displayName: 'dinhthang97',
    followers: 37500,
    statusId: '2079555518297686171',
    text: 'Test mua 1 tỷ BTC demo, lãi 34 triệu, khen vui + share mã mời.',
    sentiment: 'Bullish',
  },
  {
    stt: 10,
    handle: 'dinhthang97',
    displayName: 'dinhthang97',
    followers: 37500,
    statusId: '2079116595818013109',
    text: 'Thích giao diện VNĐ, all-in thử 1 tỷ BTC.',
    sentiment: 'Bullish',
  },
  {
    stt: 11,
    handle: 'qwarm1990',
    displayName: 'QWarm',
    followers: 28300,
    statusId: '2077725183150788627',
    text: 'Chúc mừng SCEX tài trợ vàng RWA, khuyến khích trải nghiệm demo.',
    sentiment: 'Bullish',
  },
  {
    stt: 12,
    handle: 'qwarm1990',
    displayName: 'QWarm',
    followers: 28300,
    statusId: '2072191217132285965',
    text: 'Share link ĐK + app Simulator + mã ref.',
    sentiment: 'Bullish',
  },
  {
    stt: 13,
    handle: 'qwarm1990',
    displayName: 'QWarm',
    followers: 28300,
    statusId: '2080124599636004870',
    text: 'Reply chúc mừng sàn.',
    sentiment: 'Bullish',
  },
  {
    stt: 14,
    handle: 'pigrichh',
    displayName: 'Pig Pig',
    followers: 28400,
    statusId: '2072554006246051847',
    text: 'Đăng ký thử demo 1 tỷ + share link.',
    sentiment: 'Bullish',
  },
  {
    stt: 15,
    handle: 'pigrichh',
    displayName: 'Pig Pig',
    followers: 28400,
    statusId: '2072709557101777347',
    text: 'Ghi nhận thuế 0.1% khi bán demo.',
    sentiment: 'Neutral',
  },
  {
    stt: 16,
    handle: 'lucasng990',
    displayName: 'Lucas',
    followers: 16700,
    statusId: '2072731736027586808',
    text: 'Chúc mừng sàn, đùa “lên tích vàng”.',
    sentiment: 'Bullish',
  },
  {
    stt: 17,
    handle: 'lucasng990',
    displayName: 'Lucas',
    followers: 16700,
    statusId: '2079464135268704592',
    text: 'Đùa về giao diện không đổi sang USD.',
    sentiment: 'Neutral',
  },
  {
    stt: 18,
    handle: 'vninvestblogger',
    displayName: 'Brian Truong',
    followers: 4300,
    statusId: '2074321258721013892',
    text: 'Trade demo lãi 6 triệu, khuyến khích ĐK để tìm hiểu + giúp sàn xử lý lỗi.',
    sentiment: 'Bullish',
  },
  {
    stt: 19,
    handle: 'trieutiger',
    displayName: 'Triệu Tiger',
    followers: 34700,
    statusId: '2078468333889065087',
    text: 'Hóng khi nào sàn chính thức xong.',
    sentiment: 'Neutral',
  },
  {
    stt: 20,
    handle: '0xkeng',
    displayName: '0xKeng',
    followers: 28300,
    statusId: '2072457985352417316',
    text: 'Khen chương trình đào tạo + trải nghiệm của SCEX.',
    sentiment: 'Bullish',
  },
  {
    stt: 21,
    handle: 'saintlee04',
    displayName: 'SaintLee',
    followers: 16600,
    statusId: '2072428015989207507',
    text: 'Nghe hấp dẫn, sẽ thử với giải lớn.',
    sentiment: 'Bullish',
  },
  {
    stt: 22,
    handle: 'lensmoso',
    displayName: 'Lens',
    followers: 32000,
    statusId: '2079121884960940037',
    text: 'Chúc mừng SCEX tài trợ vàng RWA Summit, hy vọng đóng góp hệ sinh thái.',
    sentiment: 'Bullish',
  },
  {
    stt: 23,
    handle: 'kt_btc',
    displayName: 'KT',
    followers: 44000,
    statusId: '2079039587067064705',
    text: 'Phân tích nếu chỉ giao dịch VND (không USDT) sẽ khó, đề xuất sớm có cặp USDT/VND.',
    sentiment: 'Neutral',
  },
  {
    stt: 24,
    handle: 'tuannguyen_6789',
    displayName: 'Minhtuan',
    followers: 72000,
    statusId: '2071951890745602141',
    text: 'Hướng dẫn chi tiết trải nghiệm SCEX + giải thưởng lớn (ref).',
    sentiment: 'Bullish',
  },
  {
    stt: 25,
    handle: 'tuannguyen_6789',
    displayName: 'Minhtuan',
    followers: 72000,
    statusId: '2071973046374854807',
    text: 'Tải app nhận 1 tỷ demo + đua top pool gần 2 tỷ.',
    sentiment: 'Bullish',
  },
  {
    stt: 26,
    handle: 'tuannguyen_6789',
    displayName: 'Minhtuan',
    followers: 72000,
    statusId: '2074366299153826243',
    text: 'Dữ liệu: TRON (STRX) volume cao nhất trên demo SCEX.',
    sentiment: 'Neutral',
  },
  {
    stt: 27,
    handle: 'tuannguyen_6789',
    displayName: 'Minhtuan',
    followers: 72000,
    statusId: '2074477185424031770',
    text: 'Review sau 1 tuần: giao diện + thanh khoản còn yếu, ra sớm để FOMO.',
    sentiment: 'Mild Bearish',
  },
  {
    stt: 28,
    handle: 'tuannguyen_6789',
    displayName: 'Minhtuan',
    followers: 72000,
    statusId: '2076914937784668529',
    text: 'Nghi ngờ top 1 BXH (volume 60 tỷ/ngày, lãi ảo cao).',
    sentiment: 'Mild Bearish',
  },
  {
    stt: 29,
    handle: 'tuannguyen_6789',
    displayName: 'Minhtuan',
    followers: 72000,
    statusId: '2075068928771129848',
    text: 'Phản ánh app SCEX tốn dung lượng (4G không chịu nổi).',
    sentiment: 'Mild Bearish',
  },
  {
    stt: 30,
    handle: 'petertran_ct',
    displayName: 'Peter Tran',
    followers: 42000,
    statusId: '2072105402142195773',
    text: 'Promo chương trình Simulator + giải thưởng lớn.',
    sentiment: 'Bullish',
  },
  {
    stt: 31,
    handle: 'petertran_ct',
    displayName: 'Peter Tran',
    followers: 42000,
    statusId: '2078398675962024357',
    text: '“Sàn Việt Nam giờ xịn thật sự luôn”.',
    sentiment: 'Bullish',
  },
  {
    stt: 32,
    handle: 'gf_capital',
    displayName: 'GF Capital',
    followers: 146000,
    statusId: '2071962351012868261',
    text: 'Hướng dẫn chi tiết tham gia pool 1.6 tỷ + ref.',
    sentiment: 'Bullish',
  },
  {
    stt: 33,
    handle: 'sangbtcethxau',
    displayName: 'Sang.BTC',
    followers: 18500,
    statusId: '2071987860664889738',
    text: 'Test OTP không về, chê công nghệ chưa ổn.',
    sentiment: 'Bearish',
  },
  {
    stt: 34,
    handle: 'udjat19',
    displayName: 'Udjat',
    followers: 4300,
    statusId: '2072092552732561637',
    text: 'Phê bình demo chỉ cho BUY (không short/futures) → mất linh hoạt.',
    sentiment: 'Mild Bearish',
  },
  {
    stt: 35,
    handle: 'gynis_tao',
    displayName: 'Noat',
    followers: 7500,
    statusId: '2079490163009634517',
    text: 'Dự đoán trước 1/9 sẽ có sàn chính thức, hỏi còn sàn nào ngoài SCEX.',
    sentiment: 'Neutral',
  },
  {
    stt: 36,
    handle: '0xpain__',
    displayName: '0xPain',
    followers: 4500,
    statusId: '2071959652829708353',
    text: 'Promo chương trình 1 tỷ ảo + giải >1.6 tỷ.',
    sentiment: 'Bullish',
    followersUnknown: true,
  },
  {
    stt: 37,
    handle: 'bigknivess',
    displayName: 'Bigknives',
    followers: 4000,
    statusId: '2071952371316654177',
    text: 'Giới thiệu chương trình đào tạo + giải thưởng.',
    sentiment: 'Bullish',
    followersUnknown: true,
  },
  {
    stt: 38,
    handle: 'quanm2831',
    displayName: 'quanm2831',
    followers: 3500,
    statusId: '2071949178893402619',
    text: 'HOT trải nghiệm giả lập SCEX free 1 tỷ VND.',
    sentiment: 'Bullish',
    followersUnknown: true,
  },
]

/** Quality heuristics by post type / author role */
function qualityForPost(row) {
  const s = mapSentiment(row.sentiment)
  const t = row.text.toLowerCase()
  if (row.isBrand) return 55
  // Analytical / constructive
  if (
    t.includes('phân tích') ||
    t.includes('đề xuất') ||
    t.includes('review') ||
    t.includes('nghi ngờ') ||
    t.includes('phê bình') ||
    t.includes('dữ liệu')
  )
    return s === 'bearish' ? 78 : 82
  if (t.includes('hướng dẫn') || t.includes('chi tiết')) return 80
  if (t.includes('otp') || t.includes('dung lượng') || t.includes('lỗi')) return 62
  if (s === 'bullish' && (t.includes('ref') || t.includes('mã mời') || t.includes('promo')))
    return 58
  if (s === 'bullish') return 68
  if (s === 'bearish') return 70
  if (s === 'neutral') return 55
  return 50
}

function dominantSentiment(counts) {
  const order = ['bullish', 'bearish', 'neutral', 'shill', 'scam']
  let best = 'neutral'
  let n = -1
  for (const k of order) {
    const c = counts[k] || 0
    if (c > n) {
      n = c
      best = k
    }
  }
  // Tie-break: if mixed bullish+bearish and neither dominates strongly
  if ((counts.bullish || 0) > 0 && (counts.bearish || 0) > 0) {
    if ((counts.bearish || 0) >= (counts.bullish || 0)) return 'bearish'
  }
  return best
}

function computeQuadrant(volume, quality, volumeSplit, qualitySplit) {
  const highVol = volume >= volumeSplit
  const highQ = quality >= qualitySplit
  if (highVol && highQ) return 'stars'
  if (!highVol && highQ) return 'nurture'
  if (highVol && !highQ) return 'noise'
  return 'ignore'
}

// Build posts
const posts = RAW_POSTS.map((r) => {
  const sent = mapSentiment(r.sentiment)
  const mild = /mild/i.test(r.sentiment)
  return {
    id: `p_${r.statusId}`,
    handle: r.handle.toLowerCase(),
    url: `https://x.com/${r.handle}/status/${r.statusId}`,
    text: r.text,
    postedAt: snowflakeToIso(r.statusId),
    sentiment: sent,
    likes: undefined,
    replies: undefined,
    reposts: undefined,
    hidden: false,
    notes: mild
      ? `STT ${r.stt} · mild_bearish (mapped to bearish) · Blue Verified snapshot`
      : r.isBrand
        ? `STT ${r.stt} · Official brand post (feed context)`
        : `STT ${r.stt} · Blue Verified mention · 23/06–23/07/2026`,
  }
})

// Aggregate actors (exclude brand from matrix)
const byHandle = new Map()
for (const r of RAW_POSTS) {
  if (r.isBrand) continue
  const h = r.handle.toLowerCase()
  if (!byHandle.has(h)) {
    byHandle.set(h, {
      handle: h,
      displayName: r.displayName,
      followers: r.followers,
      followersUnknown: !!r.followersUnknown,
      rows: [],
    })
  }
  const g = byHandle.get(h)
  g.rows.push(r)
  g.followers = Math.max(g.followers, r.followers)
  g.displayName = r.displayName
}

const volumeSplit = 2
const qualitySplit = 50
const volumeAxisMax = 8

const actors = []
for (const g of byHandle.values()) {
  const postsVolume = g.rows.length
  const sentCounts = { bullish: 0, bearish: 0, neutral: 0, shill: 0, scam: 0 }
  let qSum = 0
  let lastAt = '1970-01-01T00:00:00.000Z'
  const notesParts = []
  let mildCount = 0
  for (const r of g.rows) {
    const s = mapSentiment(r.sentiment)
    sentCounts[s] = (sentCounts[s] || 0) + 1
    qSum += qualityForPost(r)
    const at = snowflakeToIso(r.statusId)
    if (at > lastAt) lastAt = at
    if (/mild/i.test(r.sentiment)) mildCount++
    notesParts.push(r.text.slice(0, 80))
  }
  const qualityScore = Math.round(
    Math.min(100, Math.max(0, qSum / postsVolume)),
  )
  // Boost multi-post high-follower KOLs slightly for reach
  let qualityAdj = qualityScore
  if (postsVolume >= 3 && g.followers >= 20000) qualityAdj = Math.min(100, qualityAdj + 4)
  if (postsVolume >= 5) qualityAdj = Math.min(100, qualityAdj + 3)

  const sentiment = dominantSentiment(sentCounts)
  const conf =
    postsVolume <= 1
      ? 0.72
      : Math.min(0.95, 0.55 + postsVolume * 0.08)

  const tags = []
  if (sentCounts.bullish) tags.push('promo')
  if (sentCounts.bearish) tags.push(mildCount ? 'mild_bearish' : 'critique')
  if (sentCounts.neutral) tags.push('neutral')
  if (notesParts.some((t) => /rwa/i.test(t))) tags.push('rwa')
  if (notesParts.some((t) => /ref|mã mời|demo|simulator|giải/i.test(t)))
    tags.push('simulator')

  const actor = {
    id: `a_${g.handle}`,
    handle: g.handle,
    displayName: g.displayName,
    kind: 'kol',
    tier: tierFromFollowers(g.followers),
    followers: g.followers,
    reach7d: Math.round(g.followers * (1.2 + Math.min(postsVolume, 6) * 0.35)),
    postsVolume,
    qualityScore: qualityAdj,
    sentiment,
    sentimentConfidence: Math.round(conf * 100) / 100,
    quadrant: computeQuadrant(postsVolume, qualityAdj, volumeSplit, qualitySplit),
    isWhitelisted: g.followers >= 15000 || postsVolume >= 2,
    notes: [
      g.followersUnknown ? 'followers ước tính (chưa có số chính thức)' : null,
      mildCount ? `${mildCount} mild_bearish post(s)` : null,
      `Mentions: ${postsVolume} · ${notesParts.slice(0, 2).join(' · ')}`,
    ]
      .filter(Boolean)
      .join(' · '),
    lastPostAt: lastAt,
    tags: tags.join(','),
  }
  actors.push(actor)
}

// Sort actors: stars first by volume then followers
actors.sort((a, b) => {
  const q = { stars: 0, nurture: 1, noise: 2, ignore: 3 }
  const dq = (q[a.quadrant] ?? 9) - (q[b.quadrant] ?? 9)
  if (dq !== 0) return dq
  if (b.postsVolume !== a.postsVolume) return b.postsVolume - a.postsVolume
  return b.followers - a.followers
})

posts.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))

const now = new Date().toISOString()
const bullishPosts = posts.filter((p) => p.sentiment === 'bullish').length
const bearishPosts = posts.filter((p) => p.sentiment === 'bearish').length
const neutralPosts = posts.filter((p) => p.sentiment === 'neutral').length

const dataset = {
  version: 1,
  kind: 'scex-tracking',
  asOf: '2026-07-23T12:00:00.000Z',
  updatedAt: now,
  note: `Expanded Blue Verified snapshot @scexofficial / SCEX / “sàn SCEX” (23/06–23/07/2026). ${posts.length} posts · ${actors.length} KOL actors (brand posts in feed only). ~70% bullish / mixed mild critique. Not 100% of all mentions — representative high-engagement set. Mild Bearish mapped to bearish + notes.`,
  config: {
    brandName: 'SCEX',
    brandHandle: 'scexofficial',
    keywords: [
      'SCEX',
      '@scexofficial',
      'scexofficial',
      '#SCEX',
      '#SCEXSimulator',
      '#Dautruongtaisanmahoa',
      'Đấu trường Tài sản mã hóa',
      'sàn SCEX',
      'SCEX Simulator',
    ],
    timeWindowDays: 30,
    kolMinPosts: 1,
    userMinPosts: 1,
    userMinFollowers: 500,
    userMinQuality: 15,
    volumeAxis: {
      min: 0,
      max: volumeAxisMax,
      label: 'Mentions @scexofficial (30d snapshot)',
    },
    qualityAxis: {
      min: 0,
      max: 100,
      label: 'Quality engagement score',
    },
    sizeMetric: 'followers',
    volumeSplit,
    qualitySplit,
    quadrantLabels: {
      stars: {
        title: 'STARS',
        subtitle: 'High quality · active mentions — priority',
      },
      nurture: {
        title: 'NURTURE',
        subtitle: 'High quality · low volume — invite more',
      },
      noise: {
        title: 'NOISE',
        subtitle: 'Low quality · high volume — filter',
      },
      ignore: {
        title: 'IGNORE',
        subtitle: 'Low signal — archive',
      },
    },
    sentimentLabels: {
      bullish: { label: 'Bullish', color: '#22c55e' },
      bearish: { label: 'Bearish', color: '#ef4444' },
      shill: { label: 'Shill', color: '#f59e0b' },
      scam: { label: 'Scam Alert', color: '#dc2626' },
      neutral: { label: 'Neutral', color: '#94a3b8' },
    },
    matrixTitle: 'SCEX · Blue Verified mentions (30d)',
    feedTitle: 'X livefeed · @scexofficial mentions',
    enabled: true,
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
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, json, 'utf8')
  console.log('wrote', p)
}

const quadCounts = {}
for (const a of actors) {
  quadCounts[a.quadrant] = (quadCounts[a.quadrant] || 0) + 1
}
const sentCounts = {}
for (const a of actors) {
  sentCounts[a.sentiment] = (sentCounts[a.sentiment] || 0) + 1
}

console.log(
  JSON.stringify(
    {
      posts: posts.length,
      actors: actors.length,
      postSentiment: { bullish: bullishPosts, bearish: bearishPosts, neutral: neutralPosts },
      actorSentiment: sentCounts,
      quadrants: quadCounts,
      topActors: actors.slice(0, 8).map((a) => ({
        handle: a.handle,
        followers: a.followers,
        posts: a.postsVolume,
        q: a.qualityScore,
        s: a.sentiment,
        quad: a.quadrant,
      })),
    },
    null,
    2,
  ),
)

async function putR2() {
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing — skip PUT')
    return false
  }
  const putRes = await fetch(`${base}/api/scex-tracking`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dataset),
  })
  const body = await putRes.text()
  console.log('PUT /api/scex-tracking', putRes.status, body.slice(0, 300))
  if (!putRes.ok) return false
  const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
  const got = await getRes.json()
  console.log(
    'GET verify',
    getRes.status,
    {
      actors: got.actors?.length,
      posts: got.posts?.length,
      asOf: got.asOf,
      note: String(got.note || '').slice(0, 80),
    },
  )
  return getRes.ok
}

async function warmAvatars() {
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing — skip warm')
    return
  }
  const handles = [
    ...new Set([
      'scexofficial',
      ...actors.map((a) => a.handle),
    ]),
  ]
  console.log('warming avatars', handles.length)
  for (const handle of handles) {
    try {
      const check = await fetch(
        `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
      )
      if (check.ok) {
        console.log('skip', handle, 'exists')
        continue
      }
      const r = await fetch(
        `${base}/api/avatar?handle=${encodeURIComponent(handle)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      const t = await r.text()
      console.log('warm', handle, r.status, t.slice(0, 80))
    } catch (e) {
      console.log('warm err', handle, e.message)
    }
  }
}

if (doPut) {
  const ok = await putR2()
  if (!ok) process.exitCode = 1
}
if (doWarm) {
  await warmAvatars()
}
