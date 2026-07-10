/**
 * Build ~100 Tier-1 feed posts and upload to R2 (feed/v1.json).
 * Usage:
 *   set R2_* env then: node scripts/seed_feed_100.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

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
]

function templatesForNiche(niche) {
  return TEMPLATES[niche] || TEMPLATES.default
}

function buildPost(i, kol) {
  const niche = kol.niche || 'Multi'
  const tpls = templatesForNiche(niche)
  const topic = pick(TOPICS, i, 7)
  const tpl = pick(tpls, i, 3)
  const text = tpl.replace('{topic}', topic)

  // Spread over last ~10 days
  const hoursAgo = randInt(i, 1, 1, 240)
  const created = new Date(Date.now() - hoursAgo * 3600 * 1000)
  const id = String(2075000000000000000n + BigInt(i * 9973 + randInt(i, 9, 1, 9000)))

  const likes = randInt(i, 2, 0, Math.min(800, Math.floor((kol.followers || 1000) / 800)))
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

async function main() {
  const seedPath = path.join(ROOT, 'public/feed/tier1-feed.json')
  const seed = loadJson(seedPath)
  const snapshotPath = path.join(ROOT, 'data/kols-server-snapshot.json')
  let kols = []
  if (fs.existsSync(snapshotPath)) {
    kols = loadJson(snapshotPath).kols || []
  } else {
    // fallback: dynamic import of sheet
    const { SHEET_KOLS } = await import('../src/data/sheetKols.ts').catch(() => ({
      SHEET_KOLS: [],
    }))
    kols = SHEET_KOLS
  }

  const tier1 = kols.filter((k) => !k.hidden && (k.tier === 1 || k.isTop30))
  const pool =
    tier1.length >= 20
      ? tier1
      : kols.filter((k) => !k.hidden).sort((a, b) => b.score - a.score).slice(0, 40)

  const byId = new Map()
  for (const p of seed.posts || []) {
    byId.set(p.id, p)
  }

  // Generate until ~100 unique posts
  let i = 0
  while (byId.size < 100 && i < 500) {
    const kol = pool[i % pool.length]
    const post = buildPost(i + 1000, kol)
    if (!byId.has(post.id)) byId.set(post.id, post)
    i++
  }

  const posts = [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  // Cap around 100
  const finalPosts = posts.slice(0, 100)
  const handles = [...new Set(finalPosts.map((p) => p.handle))]

  const feed = {
    generatedAt: new Date().toISOString(),
    source: 'admin server r2 · dense tier1 snapshot (~100 posts)',
    mode: 'admin',
    tier: 1,
    kolCount: handles.length,
    handles,
    postCount: finalPosts.length,
    posts: finalPosts,
  }

  // Write local seed + snapshot
  fs.writeFileSync(seedPath, JSON.stringify(feed, null, 2))
  const snapPath = path.join(ROOT, 'data/feed-server-snapshot.json')
  fs.writeFileSync(snapPath, JSON.stringify(feed, null, 2))
  console.log('wrote', seedPath)
  console.log('posts', feed.postCount, 'handles', feed.kolCount)

  const accountId = process.env.R2_ACCOUNT_ID
  const access = process.env.R2_ACCESS_KEY_ID
  const secret = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME
  if (!accountId || !access || !secret || !bucket) {
    console.warn('R2 env missing — local files only')
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
