/**
 * Rewrite top 2–10 KOL bios in ThuanCapital product style (no sheet refs),
 * then PUT to /api/kols.
 *
 * Usage: node scripts/refresh_top10_bios.mjs
 * Needs .env.production.local with FEED_ADMIN_TOKEN
 * and TEMP/kols-server.json or fetches live API.
 */
import fs from 'fs'
import { adminGetJson, adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[line.slice(0, i).trim()] = v
  }
  return out
}

const env = {
  ...loadEnv(path.join(ROOT, '.env.production.local')),
  ...loadEnv(path.join(ROOT, '.env.local')),
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  FEED_ADMIN_TOKEN: process.env.FEED_ADMIN_TOKEN,
}
const token = (env.FEED_ADMIN_TOKEN || '').trim()
const r2Ready = !!(
  env.R2_ACCOUNT_ID &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET_NAME
)
if (!token && !r2Ready) {
  console.error('Need FEED_ADMIN_TOKEN or R2_* credentials')
  process.exit(1)
}

const fmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const x = Number(n)
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`
  if (x >= 1000) return `${(x / 1000).toFixed(1)}K`
  return String(Math.round(x))
}

function followGraph(followers, following) {
  if (!followers) return 'chưa rõ follow graph'
  const r = (following || 0) / followers
  if (r < 0.02)
    return `broadcast mạnh (following/followers ~${(r * 100).toFixed(2)}%) — one-to-many`
  if (r < 0.08)
    return `broadcast (following/followers ~${(r * 100).toFixed(2)}%)`
  return `cân bằng hơn (following ~${fmt(following)}, ratio ~${(r * 100).toFixed(1)}%)`
}

function a7Block(k) {
  const posts = k.activity7dPosts
  const likes = k.activity7dLikes
  const views = k.activity7dViews
  const replies = k.activity7dReplies
  const reposts = k.activity7dReposts
  const score = k.activity7dScore
  const src = k.activity7dSource || 'estimated'
  const srcNote =
    src === 'sampled'
      ? 'mẫu post X (sampled; có thể bị cap ~10)'
      : 'ước từ pace lifetime × 7 (estimated, chưa sample full search)'
  if (posts == null) {
    return 'Cửa sổ 7 ngày: chưa có số hoạt động 7d trên Radar — chỉ dựa pace lifetime và status hiện tại.'
  }
  const lp = posts > 0 && likes != null ? (likes / posts).toFixed(1) : '—'
  const vp = posts > 0 && views != null ? fmt(views / posts) : '—'
  const reach =
    posts > 0 && views != null && k.followers
      ? `${((views / posts / k.followers) * 100).toFixed(2)}%`
      : '—'
  return `Cửa sổ 7 ngày: ~${posts} posts · ${fmt(likes)} likes · ${fmt(views)} views · ${fmt(replies)} replies · ${fmt(reposts)} reposts · 7d score ${score ?? '—'} (${srcNote}). ~${lp} like/post, ~${vp} view/post, reach proxy ~${reach} followers/post.`
}

function statusRead(k) {
  const st = k.statusLabel || 'stable'
  const map = {
    hot: 'HOT — nhịp gần đây mạnh, phù hợp bật narrative 24–72h trên Radar.',
    active: 'ACTIVE — duy trì presence đều, giữ mindshare ổn định.',
    stable: 'STABLE — base audience ổn, không bùng nổ short-term.',
    quiet:
      'QUIET — output X thấp hơn; kiểm tra kênh phụ nếu campaign phụ thuộc Twitter.',
    dormant:
      'DORMANT — gần im trên X; không sole-lead nếu KPI phụ thuộc X.',
  }
  return `Đọc trạng thái trên Radar: ${map[st] || st} Composite score ~${k.score}/100 (blend base size + hot/activity). Activity level ~${k.activityLevel ?? '—'}. ${k.isTop30 ? 'Nằm Top 30 visibility trên map.' : ''}`
}

const POSITIONING = {
  emilyyvuong: {
    pos: 'Trading + Crypto News Creator',
    media: 'thiên media/visual (chart, screenshot tin, clip ngắn)',
    selfBio: 'For informational purposes only — Not Financial Advice',
    themes:
      'tin thị trường, góc trading/news hybrid, cập nhật nhanh cho audience VN theo dõi price action + headline crypto',
    fit: 'Primary/co-lead cho brief news + trading mindshare; mid-funnel awareness. Hợp announce, market wrap, product launch khi cần voice creator đã scale audience. Rủi ro: growth followers rất mạnh so với baseline cũ — nên đối chiếu organic vs paid; engagement có thể loãng khi volume cao.',
    growth:
      'Audience scale mạnh (followers live ~163.7K). Delta so baseline cũ ~+192% — account đang mở rộng nhanh, cần theo dõi chất lượng audience.',
  },
  thekhuongeth: {
    pos: 'Meme / Culture & Super-cycle Narratives',
    media: 'mix text + media, narrative meme/AI/multi-planet style',
    selfBio:
      'ủng hộ Elon/AI/multi-planet và lý thuyết “super-cycle memecoin”',
    themes:
      'meme culture, AI narrative, memecoin super-cycle, community banter',
    fit: 'Awareness / meme push, co-lead culture campaign. Mạnh viral potential, yếu conversion đo lường. Rủi ro: narrative meme biến động nhanh; eng có thể FOMO-heavy. Verified giúp trust signal.',
    growth:
      'Followers live ~163.0K — base giữ tương đối phẳng (~-2% so baseline cũ).',
  },
  TCVNcommunity: {
    pos: 'Vietnam Crypto Community Hub',
    media: 'thiên media/visual, community + market updates',
    selfBio:
      'cộng đồng crypto lớn tại Việt Nam; partnership + community link trong bio',
    themes:
      'community pulse, trading/news desk collective, partnership announcements',
    fit: 'Primary community amplification cho campaign VN; co-lead announce + quest. Hợp brand awareness, event, collab multi-KOL. Rủi ro: community account có thể loãng eng/post; cần brief rõ CTA.',
    growth: 'Followers live ~63.2K — base ổn, gần phẳng so baseline.',
  },
  LeninUGReal: {
    pos: 'Trader / High-conviction Calls',
    media: 'mix text + media, ticker/TP style',
    selfBio:
      'chuỗi hold/TP các ticker (LINK, FET, DOGE, SHIB, SOL, ADA, TON, SUI…)',
    themes: 'price calls, portfolio conviction, market timing',
    fit: 'Trading brief gắn market timing; co-lead khi cần voice chart/call. Rủi ro: audience nhạy price action — tránh over-promise; nội dung TP-style có thể conflict compliance. Verified.',
    growth: 'Followers live ~190.3K — base mega, gần phẳng (+~2%).',
  },
  immrape: {
    pos: 'Trader / Project Sharing (Mr.Ape)',
    media: 'thiên text/thread hơn visual',
    selfBio:
      'Mr.Ape — chia sẻ project mình thích, disclaimer không phải investment advice, mang value cho community #Bitcoin',
    themes:
      'project picks, Bitcoin-centric narrative, community value posts',
    fit: 'Co-lead trading/project spotlight; awareness BTC narrative. Chưa verified — dựa reputation. Rủi ro: mega-audience có thể vanity; eng/post cần check khi brief paid.',
    growth: 'Followers live ~425.2K — mega scale, gần phẳng (~-1%).',
  },
  Namxuceo: {
    pos: 'Trader / Personality Voice',
    media: 'thiên text/thread, giọng cá nhân mạnh',
    selfBio: 'quote José Mourinho — giọng competitive/personality-led',
    themes: 'trading takes, personality content, community banter',
    fit: 'Awareness + personality collab; trading mindshare. Chưa verified. Rủi ro: tone cá nhân mạnh — brand fit cần align; eng loãng nếu volume cao.',
    growth: 'Followers live ~111.2K — base lớn, ổn định (+~2%).',
  },
  tranthanhbk: {
    pos: 'Builder · Researcher · Airdrop / Quest',
    media: 'mix text + media, instruction-style / builder updates',
    selfBio:
      'Builder @VNRetroactive | Researcher | Trader | Axis Robotics Ambassador | TG riêng | NFA',
    themes:
      'airdrop/quest checklist, research notes, builder updates, trading side',
    fit: 'Primary cho launch farming / quest / checklist campaign; co-lead research-lite. HOT trên Radar — phù hợp push 24–72h. Rủi ro: pace rất dày (~15 post/ngày) dễ loãng eng; following cao — network-heavy; growth delta lớn (+~501% baseline) cần check quality.',
    growth:
      'Followers live ~96.2K — scale rất nhanh so baseline cũ (+~501%).',
  },
  NamOK_bnb: {
    pos: 'Trader / BNB Ecosystem Voice',
    media: 'thiên text/thread, disclaimer NFA rõ',
    selfBio:
      'giọng tự trào + disclaimer ý kiến cá nhân, không phải lời khuyên đầu tư',
    themes: 'trading takes, BNB/ecosystem chatter, market calls',
    fit: 'Primary short-horizon trading push (status HOT); co-lead BNB/DeFi lite. Verified. Rủi ro: followers ~40K nhỏ hơn top mega — reach tuyệt đối thấp hơn nhưng pace cao; eng/post cần sample thật trước paid heavy.',
    growth:
      'Followers live ~39.8K — hơi co (~-7% baseline); vẫn usable, nên theo dõi churn.',
  },
  nambitdefi: {
    pos: 'DeFi · OTC · BTC Holder',
    media: 'mix text + media, DeFi/OTC angle',
    selfBio:
      'Web3 Builder, OTC services, all-in BTC, 8 year ex OTC trading Vietnam',
    themes:
      'DeFi product talk, OTC trust, Bitcoin hold narrative, market banter',
    fit: 'Primary/co-lead DeFi education, OTC trust, BTC narrative. Status HOT — tốt cho push ngắn. Verified. Rủi ro: OTC claims cần brand diligence; pace cao có thể loãng eng.',
    growth: 'Followers live ~39.5K — tăng nhẹ (+~9% baseline).',
  },
}

function buildBio(k) {
  const m = POSITIONING[k.handle]
  if (!m) return null
  const name = k.displayName || k.handle
  const verified = k.verified
    ? 'Tài khoản đã xác minh tích xanh.'
    : 'Chưa verified trên X — dựa reputation/community.'
  const pace =
    k.tweetsPerDay != null
      ? `Pace lifetime ~${Number(k.tweetsPerDay).toFixed(1)} post/ngày; tổng ~${fmt(k.tweetsTotal)} posts.`
      : 'Pace lifetime: chưa có tweetsPerDay đầy đủ.'
  const ageHint =
    k.tweetsTotal && k.tweetsPerDay
      ? ` Ước tuổi hoạt động ~${Math.max(1, k.tweetsTotal / (k.tweetsPerDay * 365)).toFixed(1)} năm (proxy từ tổng post / pace).`
      : ''

  const p1 = `${name} (@${k.handle})
Tier ${k.tier}, positioning «${m.pos}»
→ niche ${k.niche}.
${verified}
Tóm tắt self-bio X: ${m.selfBio}.`

  const p2 = `${m.growth}
Follow graph: ${followGraph(k.followers, k.xFollowing)}. Nội dung ${m.media}.
Quality proxy (nội bộ Radar, không phải Smart Followers X chính thức): ~${fmt(k.smartFollowers)}.`

  const p3 = `${pace}${ageHint} Vận hành theo hướng series/curated feed hơn one-off spam; phù hợp giữ mindshare trên map Radar.`

  const p4 = a7Block(k)
  const p5 = `Theme / góc nội dung gần đây (định vị): ${m.themes}.`
  const p6 = statusRead(k)
  const p7 = `Định vị dùng KOL trên Radar (campaign fit): ${m.fit}`

  return [p1, p2, p3, p4, p5, p6, p7].join('\n\n')
}

async function main() {
  let d
  const tmp = path.join(process.env.TEMP || '/tmp', 'kols-server.json')
  if (fs.existsSync(tmp)) {
    d = JSON.parse(fs.readFileSync(tmp, 'utf8'))
  } else {
    d = token
      ? await adminGetJson('https://radar.daveynfts.com/api/kols', token)
      : await (async () => {
          const res = await fetch('https://radar.daveynfts.com/api/kols')
          if (!res.ok) throw new Error(`GET /api/kols ${res.status}`)
          return res.json()
        })()
  }

  const byHandle = new Map(d.kols.map((k) => [k.handle, k]))
  const top = [...d.kols]
    .filter((k) => !k.hidden)
    .sort((a, b) => b.score - a.score || b.followers - a.followers)
    .slice(0, 10)

  let updated = 0
  for (const k of top) {
    if (k.handle === 'ThuanCapital') {
      console.log('keep', k.handle, 'bioLen', (k.bio || '').length)
      continue
    }
    const bio = buildBio(k)
    if (!bio) {
      console.log('skip', k.handle)
      continue
    }
    const target = byHandle.get(k.handle)
    target.bio = bio
    if (!String(target.dataSource || '').includes('admin')) {
      target.dataSource = 'admin'
    }
    if (target.typeRaw === 'ALL') target.typeRaw = 'Community / Multi'
    if (String(target.typeRaw).toLowerCase() === 'meme') target.typeRaw = 'Meme'
    updated++
    console.log('OK', k.handle, 'bioLen', bio.length)
  }

  const payload = {
    version: d.version || 3,
    updatedAt: new Date().toISOString(),
    source: 'admin server · top2-10 bio refresh (radar product style)',
    note: 'Rewrite top 2-10 bios like ThuanCapital; no sheet references',
    count: d.kols.length,
    kols: d.kols,
  }

  if (token) {
    const res = await adminPutJson('https://radar.daveynfts.com/api/kols', token, payload)
    const body = await res.json().catch(() => ({}))
    console.log('PUT api', res.status, JSON.stringify(body))
    if (!res.ok) process.exit(1)
  } else if (r2Ready) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    })
    await client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: 'kols/v1.json',
        Body: JSON.stringify(payload),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-store',
      }),
    )
    console.log('PUT r2 kols/v1.json ok')
  }

  fs.writeFileSync(
    path.join(ROOT, 'data', 'kols-server-snapshot.json'),
    JSON.stringify(payload, null, 2),
  )
  console.log('updated handles', updated)
  console.log('wrote data/kols-server-snapshot.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
