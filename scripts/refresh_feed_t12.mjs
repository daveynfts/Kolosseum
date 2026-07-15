/**
 * Refresh X Feed for Tier 1 + Tier 2:
 * - Archive posts older than 7 days into archivedPosts
 * - Generate fresh posts within the last 7 days (bias toward "today")
 * - Write public/feed/tier1-feed.json + data/feed-server-snapshot.json
 *
 * Usage: node scripts/refresh_feed_t12.mjs
 * Optional R2 upload if R2_* env set.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const TARGET_LIVE = 120

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function seeded(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function pick(arr, i, salt = 0) {
  return arr[Math.floor(seeded(i, salt) * arr.length) % arr.length]
}

function randInt(i, salt, a, b) {
  return a + Math.floor(seeded(i, salt) * (b - a + 1))
}

const TEMPLATES = {
  News: [
    'Cập nhật thị trường: {topic}. Dòng tiền ngắn hạn đang xoay quanh narrative này — theo dõi volume và funding rate.',
    'Tin nhanh: {topic}. Ảnh hưởng tới sentiment VN trong 24–48h tới; không phải lời khuyên đầu tư.',
    '{topic}. Institutional flow + policy vẫn là trục chính tuần này. NFA.',
    'Headline: {topic}. Team Radar ghi nhận eng tăng trên các voice news desk VN.',
  ],
  Trading: [
    'Setup {topic}: quan sát vùng support/resistance, không FOMO. Risk management trước hết. NFA.',
    '{topic} — volume xác nhận? Chờ retest trước khi size. Chỉ mang tính tham khảo.',
    'Chart note: {topic}. Bias ngắn hạn, luôn có stop. NFA.',
    'Market structure: {topic}. Ưu tiên R:R rõ trước khi vào lệnh. NFA.',
  ],
  Research: [
    'Thread note: {topic}. Đọc thêm tokenomics / unlock schedule trước khi kết luận.',
    'Research snapshot — {topic}. Framework: utility, demand sink, distribution.',
    '{topic}. So sánh peer set + metrics on-chain (nếu có) trước khi define conviction.',
  ],
  DeFi: [
    'DeFi pulse: {topic}. Check TVL, emissions và smart money flows. NFA.',
    '{topic}. Ưu tiên protocol risk + oracle design khi đánh giá yield.',
    'Yield note: {topic}. Real yield vs subsidized — đừng chỉ nhìn APY. NFA.',
  ],
  Meme: [
    '{topic} 😂 Narrative ngắn, eng cao — chơi eng/awareness chứ đừng all-in. NFA.',
    'Meme desk: {topic}. FOMO window ngắn; size nhỏ nếu tham gia. NFA.',
  ],
  Multi: [
    'Alpha note: {topic}. Cross-check 2–3 nguồn trước khi share. NFA.',
    '{topic}. Cộng đồng VN đang bàn tán khá nhiều về góc này tuần qua.',
  ],
  Airdrop: [
    'Quest/airdrop note: {topic}. Ưu tiên checklist + sybil risk. NFA.',
    '{topic}. Làm task có chọn lọc — chất lượng activity > spam. NFA.',
  ],
  OTC: [
    'OTC desk: {topic}. Liquidity block / settlement vẫn là điểm nghẽn. NFA.',
    '{topic}. Size lớn nên ưu tiên counterparty trust. NFA.',
  ],
  default: [
    'Update: {topic}. Theo dõi thêm 24h trước khi chốt view. NFA.',
    '{topic}. Share nhanh cho timeline — tự DYOR. NFA.',
  ],
}

const TOPICS = [
  'BTC retest vùng tâm lý quan trọng',
  'ETH L2 fee compression tiếp tục',
  'Solana meme rotation sang infra',
  'ETF flow Mỹ phiên vừa rồi',
  'Stablecoin volume trên Polygon / Arb',
  'Funding rate perp quay về trung tính',
  'Unlock lịch sử token mid-cap tuần này',
  'Narrative AI + crypto agents',
  'RWA tokenization update',
  'Perp DEX volume share',
  'Oracle / CCIP integration news',
  'Binance listing rumor filter',
  'Macro CPI / risk-on session',
  'Liquidation cascade tránh vùng nóng',
  'Restaking yield nén dần',
  'Point season sắp hết — farm có chọn lọc',
  'VN community AMA highlight',
  'Gaming token unlock + player metrics',
  'BTC dominance vs alt season debate',
  'Stablecoin regulation headline',
  'Market maker inventory signal',
  'On-chain whale accumulation cluster',
  'Options expiry max pain zone',
  'LRT / L2 bridging friction',
  'NFT volume thin nhưng bluechip ổn',
  'Fed speak + DXY ảnh hưởng risk assets',
  'Asia session open — liquidity check',
  'Memecoin liquidity migration note',
]

function nicheOf(kol) {
  if (Array.isArray(kol.niches) && kol.niches[0]) return kol.niches[0]
  return kol.niche || 'Multi'
}

function templatesForNiche(niche) {
  return TEMPLATES[niche] || TEMPLATES.default
}

/** Bias: ~40% last 24h, rest spread over 7 days */
function hoursAgoFor(i) {
  const r = seeded(i, 21)
  if (r < 0.4) return randInt(i, 22, 0, 23) // today
  if (r < 0.7) return randInt(i, 23, 24, 72) // 1–3d
  return randInt(i, 24, 73, 160) // rest of week (~7d)
}

function buildPost(i, kol, saltBase = 5000) {
  const niche = nicheOf(kol)
  const tpls = templatesForNiche(niche)
  const topic = pick(TOPICS, i, 7 + saltBase)
  const tpl = pick(tpls, i, 3 + saltBase)
  const text = tpl.replace('{topic}', topic)
  const hoursAgo = hoursAgoFor(i + saltBase)
  const created = new Date(Date.now() - hoursAgo * 3600 * 1000)
  const id = String(
    2088000000000000000n + BigInt(i * 9973 + randInt(i, 9 + saltBase, 1, 9000) + saltBase),
  )
  const likes = randInt(
    i,
    2,
    0,
    Math.min(800, Math.floor((kol.followers || 1000) / 800)),
  )
  const views = likes * randInt(i, 4, 40, 180) + randInt(i, 5, 100, 5000)
  const replies = randInt(i, 6, 0, Math.max(2, Math.floor(likes / 8)))
  const reposts = randInt(i, 8, 0, Math.max(1, Math.floor(likes / 12)))

  return {
    id,
    handle: kol.handle,
    displayName: kol.displayName || kol.handle,
    text,
    createdAt: created.toISOString(),
    likes,
    reposts,
    replies,
    views,
    media: [],
    isReply: false,
    url: `https://x.com/${kol.handle}/status/${id}`,
    avatarLocal: `/avatars/${kol.handle}.jpg`,
  }
}

function archiveSplit(posts, now = Date.now()) {
  const cutoff = now - WEEK_MS
  const live = []
  const archived = []
  for (const p of posts) {
    const t = Date.parse(p.createdAt)
    if (Number.isFinite(t) && t < cutoff) archived.push(p)
    else live.push(p)
  }
  return { live, archived }
}

async function main() {
  const seedPath = path.join(ROOT, 'public/feed/tier1-feed.json')
  const prev = fs.existsSync(seedPath) ? loadJson(seedPath) : { posts: [], archivedPosts: [] }

  const snapshotPath = path.join(ROOT, 'data/kols-server-snapshot.json')
  let kols = []
  if (fs.existsSync(snapshotPath)) {
    kols = loadJson(snapshotPath).kols || []
  }

  const pool = kols
    .filter((k) => !k.hidden && (k.tier === 1 || k.tier === 2))
    .sort((a, b) => (a.tier ?? 3) - (b.tier ?? 3) || b.score - a.score)

  if (pool.length === 0) {
    console.error('No T1/T2 KOLs found')
    process.exit(1)
  }

  // 1) Archive old from previous feed
  const prevPosts = prev.posts || []
  const prevArchived = prev.archivedPosts || []
  const { live: keptLive, archived: newlyArchived } = archiveSplit(prevPosts)

  const archById = new Map()
  for (const p of prevArchived) archById.set(p.id, p)
  for (const p of newlyArchived) archById.set(p.id, p)

  // 2) Keep recent real posts that are still within window
  const liveById = new Map()
  for (const p of keptLive) liveById.set(p.id, p)

  // 3) Generate fresh posts until TARGET_LIVE (T1+T2)
  let i = 0
  const daySalt = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''))
  while (liveById.size < TARGET_LIVE && i < 800) {
    const kol = pool[i % pool.length]
    const post = buildPost(i + 1, kol, daySalt % 10000)
    // only keep if within 7d (generator already biases)
    const t = Date.parse(post.createdAt)
    if (Number.isFinite(t) && t >= Date.now() - WEEK_MS && !liveById.has(post.id)) {
      liveById.set(post.id, post)
    }
    i++
  }

  const livePosts = [...liveById.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  // Cap live
  const finalLive = livePosts.slice(0, TARGET_LIVE)
  // Anything overflow not needed — discard (they're synthetic)

  const archivedPosts = [...archById.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const handles = [...new Set(finalLive.map((p) => p.handle))]

  const feed = {
    generatedAt: new Date().toISOString(),
    source: 'admin · refresh T1+T2 feed · archive >7d',
    mode: 'admin',
    tier: 12,
    kolCount: handles.length,
    handles,
    postCount: finalLive.length,
    posts: finalLive,
    archivedPosts,
    archivedCount: archivedPosts.length,
  }

  fs.writeFileSync(seedPath, JSON.stringify(feed, null, 2))
  const snapPath = path.join(ROOT, 'data/feed-server-snapshot.json')
  fs.writeFileSync(snapPath, JSON.stringify(feed, null, 2))

  const oldest = finalLive[finalLive.length - 1]?.createdAt
  const newest = finalLive[0]?.createdAt
  console.log('wrote', seedPath)
  console.log(
    'live',
    feed.postCount,
    'archived',
    feed.archivedCount,
    'voices',
    feed.kolCount,
    'pool T1+T2',
    pool.length,
  )
  console.log('range', oldest, '→', newest)
  console.log('newly archived from prev', newlyArchived.length)

  const accountId = process.env.R2_ACCOUNT_ID
  const access = process.env.R2_ACCESS_KEY_ID
  const secret = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME
  if (!accountId || !access || !secret || !bucket) {
    console.warn('R2 env missing — seed files only (Save to server from Admin to publish)')
    return
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: access, secretAccessKey: secret },
    forcePathStyle: true,
  })
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: 'feed/v1.json',
      Body: JSON.stringify(feed),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-store',
    }),
  )
  console.log('PUT r2 feed/v1.json ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
