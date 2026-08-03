/**
 * Refresh live X Feed for top-3 ranks: Challenger + Master + Diamond.
 * 1) Prefer live tweets via X guest GraphQL (UserTweets)
 * 2) Fallback: jina profile scrape → fxtwitter status
 * 3) Fill synthetic if still short of TARGET_LIVE
 * 4) Archive posts older than 14 days
 * 5) Write public/feed + snapshot; PUT /api/feed if FEED_ADMIN_TOKEN set
 *
 *   node scripts/refresh_feed_challenger_master.mjs
 *   node scripts/refresh_feed_challenger_master.mjs --no-live   # synthetic only
 *   node scripts/refresh_feed_challenger_master.mjs --fresh
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
/** Live window / archive cutoff (posts older than this leave X Feed live) */
const LIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const WEEK_MS = LIVE_WINDOW_MS // legacy name used in archiveSplit / filters
const TARGET_LIVE = 140
const PER_KOL_LIVE = 6
const TOP_RANKS = new Set(['challenger', 'master', 'diamond'])
const noLive = process.argv.includes('--no-live')
/** Drop prior seed posts and rebuild live-first (still archives old) */
const freshRebuild = process.argv.includes('--fresh')

/** Public web client bearer (same as x.com guest sessions) */
const X_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
const USER_TWEETS_QID = 'V1ze5q3ijDS1VeLwLY0m7g'

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

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getKolRank(k) {
  const r = k.rank
  if (
    r === 'challenger' ||
    r === 'master' ||
    r === 'diamond' ||
    r === 'platinum' ||
    r === 'gold'
  )
    return r
  const tier = k.tier ?? 3
  const score = k.score ?? 50
  if (tier <= 1) {
    if (score >= 96 || (k.isTop30 && score >= 94.5)) return 'challenger'
    return 'master'
  }
  if (tier === 2) {
    if (score >= 92) return 'diamond'
    return 'platinum'
  }
  return 'gold'
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
    'Cập nhật: {topic}. Sentiment VN theo dõi sát 24–48h. NFA.',
    'Tin nhanh · {topic}. Cross-check volume & funding. NFA.',
  ],
  Trading: [
    'Setup note · {topic}. Risk first, không FOMO. NFA.',
    'Chart · {topic}. Chờ confirm trước khi size. NFA.',
  ],
  Research: [
    'Research · {topic}. Đọc tokenomics / unlock trước khi chốt view. NFA.',
  ],
  DeFi: ['DeFi pulse · {topic}. Check TVL + real yield. NFA.'],
  Multi: ['Update · {topic}. DYOR · NFA.'],
  Airdrop: ['Quest note · {topic}. Sybil risk — farm có chọn lọc. NFA.'],
  OTC: ['OTC desk · {topic}. Counterparty trust trước size. NFA.'],
  default: ['Update · {topic}. NFA · DYOR.'],
}

const TOPICS = [
  'BTC session Asia',
  'ETH L2 fee compression',
  'ETF flow snapshot',
  'Stablecoin volume',
  'Perp funding trung tính',
  'RWA narrative',
  'AI agents x crypto',
  'Unlock mid-cap tuần này',
  'Macro risk-on/off',
  'VN community highlight',
  'Liquidation map',
  'Alt rotation watch',
]

function nicheOf(kol) {
  if (Array.isArray(kol.niches) && kol.niches[0]) return kol.niches[0]
  return kol.niche || 'Multi'
}

function buildSynthetic(i, kol, saltBase = 1) {
  const niche = nicheOf(kol)
  const tpls = TEMPLATES[niche] || TEMPLATES.default
  const topic = pick(TOPICS, i, 7 + saltBase)
  const text = pick(tpls, i, 3 + saltBase).replace('{topic}', topic)
  const hoursAgo =
    seeded(i, 21 + saltBase) < 0.55
      ? randInt(i, 22, 0, 20)
      : randInt(i, 23, 21, 100)
  const created = new Date(Date.now() - hoursAgo * 3600 * 1000)
  const id = String(
    2091000000000000000n +
      BigInt(i * 9973 + randInt(i, 9 + saltBase, 1, 9000) + saltBase * 13),
  )
  const likes = randInt(
    i,
    2,
    2,
    Math.min(400, Math.floor((kol.followers || 1000) / 1000) + 20),
  )
  const views = likes * randInt(i, 4, 50, 200) + randInt(i, 5, 200, 4000)
  return {
    id,
    handle: kol.handle,
    displayName: kol.displayName || kol.handle,
    text,
    createdAt: created.toISOString(),
    likes,
    reposts: randInt(i, 8, 0, Math.max(1, Math.floor(likes / 10))),
    replies: randInt(i, 6, 0, Math.max(2, Math.floor(likes / 6))),
    views,
    media: [],
    isReply: false,
    url: `https://x.com/${kol.handle}/status/${id}`,
    avatarLocal: `/avatars/${kol.handle}.jpg`,
    isSynthetic: true,
  }
}

/** Heuristic: seed posts from our generators (not real X snowflakes we fetched) */
function isSyntheticPost(p) {
  if (!p) return true
  if (p.isSynthetic === true) return true
  const id = String(p.id || '')
  // Explicit seed ranges used by seed_feed_100 / refresh_feed_t12 / this script
  if (/^209[01]/.test(id) || /^208[89]/.test(id)) return true
  // Template-like copy from our generators
  const t = String(p.text || '')
  if (
    /^(Cập nhật:|Tin nhanh ·|Setup note ·|Chart ·|Research ·|DeFi pulse ·|Update ·|Quest note ·|OTC desk ·)/.test(
      t,
    ) &&
    /\bNFA\b/.test(t)
  ) {
    return true
  }
  return false
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

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function snowflakeMs(id) {
  try {
    return Number(BigInt(id) >> 22n) + 1288834974657
  } catch {
    return NaN
  }
}

let guestToken = null
let guestFetchedAt = 0
const userIdCache = new Map()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function ensureGuestToken(force = false) {
  if (
    !force &&
    guestToken &&
    Date.now() - guestFetchedAt < 12 * 60 * 1000
  ) {
    return guestToken
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(
        'https://api.twitter.com/1.1/guest/activate.json',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${X_BEARER}`,
            'User-Agent': UA,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        },
      )
      const text = await r.text()
      if (r.status === 429 || /rate limit/i.test(text)) {
        await sleep(2500 * (attempt + 1))
        continue
      }
      if (!r.ok) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      const j = JSON.parse(text)
      guestToken = j.guest_token
      guestFetchedAt = Date.now()
      if (guestToken) return guestToken
    } catch {
      await sleep(1000 * (attempt + 1))
    }
  }
  throw new Error('guest activate failed')
}

function guestHeaders(token) {
  return {
    Authorization: `Bearer ${X_BEARER}`,
    'x-guest-token': token,
    'User-Agent': UA,
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
    Accept: '*/*',
    Cookie: `guest_id=v1%3A${token}`,
  }
}

async function resolveUserId(handle) {
  const key = handle.toLowerCase()
  if (userIdCache.has(key)) return userIdCache.get(key)

  // Prefer GraphQL (same guest session) — fewer external rate limits
  try {
    const token = await ensureGuestToken()
    const features = {
      hidden_profile_subscriptions_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
    }
    const q = new URLSearchParams({
      variables: JSON.stringify({
        screen_name: handle,
        withSafetyModeUserFields: true,
      }),
      features: JSON.stringify(features),
    })
    const r = await fetch(
      `https://api.twitter.com/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?${q}`,
      {
        headers: guestHeaders(token),
        signal: AbortSignal.timeout(15000),
      },
    )
    const text = await r.text()
    if (r.status === 429 || /rate limit/i.test(text)) {
      await sleep(3000)
      await ensureGuestToken(true)
    } else if (r.ok) {
      const j = JSON.parse(text)
      const id = j?.data?.user?.result?.rest_id
      if (id) {
        userIdCache.set(key, String(id))
        return String(id)
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const r = await fetch(`https://api.fxtwitter.com/${handle}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'vn-kol-radar/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (r.ok) {
      const j = await r.json()
      const id = j.user?.id || j.id
      if (id) {
        userIdCache.set(key, String(id))
        return String(id)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function unwrapTweetResult(node) {
  if (!node || typeof node !== 'object') return null
  if (node.__typename === 'Tweet' || node.legacy) return node
  if (node.__typename === 'TweetWithVisibilityResults' && node.tweet)
    return node.tweet
  if (node.tweet) return unwrapTweetResult(node.tweet)
  if (node.result) return unwrapTweetResult(node.result)
  return null
}

function tweetNodeToPost(node, expectedHandle, displayName) {
  const tw = unwrapTweetResult(node)
  if (!tw?.legacy) return null
  const leg = tw.legacy
  const id = String(tw.rest_id || leg.id_str || '')
  if (!id) return null
  const user =
    tw.core?.user_results?.result?.legacy ||
    tw.core?.user_results?.result ||
    {}
  const handle = String(
    user.screen_name || expectedHandle || '',
  ).replace(/^@/, '')
  if (
    expectedHandle &&
    handle &&
    handle.toLowerCase() !== expectedHandle.toLowerCase()
  ) {
    // retweet / quoted other author — skip for author-only feed
    return null
  }
  // skip pure retweets
  if (leg.retweeted_status_result || /^RT @/i.test(leg.full_text || '')) {
    return null
  }
  const text = decodeEntities(leg.full_text || leg.text || '').trim()
  if (!text) return null
  let createdAt
  if (leg.created_at) {
    createdAt = new Date(leg.created_at).toISOString()
  } else {
    const ms = snowflakeMs(id)
    createdAt = Number.isFinite(ms)
      ? new Date(ms).toISOString()
      : new Date().toISOString()
  }
  const media = []
  const mediaEntities =
    leg.extended_entities?.media || leg.entities?.media || []
  for (const m of mediaEntities) {
    if (m.media_url_https) media.push(m.media_url_https)
    else if (m.media_url) media.push(m.media_url)
  }
  const views = Number(tw.views?.count || leg.ext_views || 0) || 0
  return {
    id,
    handle: expectedHandle || handle,
    displayName: displayName || user.name || handle,
    text,
    createdAt,
    likes: Number(leg.favorite_count || 0) || 0,
    reposts: Number(leg.retweet_count || 0) || 0,
    replies: Number(leg.reply_count || 0) || 0,
    views,
    media: [...new Set(media)].slice(0, 4),
    isReply: !!(leg.in_reply_to_status_id_str || leg.in_reply_to_user_id_str),
    url: `https://x.com/${expectedHandle || handle}/status/${id}`,
    avatarLocal: `/avatars/${expectedHandle || handle}.jpg`,
    isSynthetic: false,
  }
}

function collectTweetsFromTimeline(json, handle, displayName) {
  const posts = []
  const seen = new Set()
  const instructions =
    json?.data?.user?.result?.timeline_v2?.timeline?.instructions ||
    json?.data?.user?.result?.timeline?.timeline?.instructions ||
    []

  const KEYS = new Set([
    'tweet_results',
    'itemContent',
    'content',
    'entries',
    'entry',
    'items',
    'item',
    'result',
    'tweet',
    'legacy',
    'core',
    'moduleItems',
    'itemContents',
  ])

  function visit(obj, depth = 0) {
    if (!obj || depth > 16) return
    if (Array.isArray(obj)) {
      for (const x of obj) visit(x, depth + 1)
      return
    }
    if (typeof obj !== 'object') return
    if (
      obj.__typename === 'Tweet' ||
      obj.__typename === 'TweetWithVisibilityResults' ||
      (obj.legacy?.full_text && (obj.rest_id || obj.legacy.id_str))
    ) {
      const p = tweetNodeToPost(obj, handle, displayName)
      if (p && !seen.has(p.id)) {
        seen.add(p.id)
        posts.push(p)
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (KEYS.has(k)) visit(v, depth + 1)
    }
  }

  for (const ins of instructions) visit(ins)
  // Fallback: full tree scan if instructions empty but payload has tweets
  if (!posts.length && json?.data) visit(json.data, 0)
  return posts
}

const USER_TWEETS_FEATURES = {
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

async function fetchViaGuestTimeline(kol) {
  const handle = kol.handle
  const userId = await resolveUserId(handle)
  if (!userId) return []

  const variables = {
    userId: String(userId),
    count: 40,
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true,
    withV2Timeline: true,
  }
  const q = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(USER_TWEETS_FEATURES),
  })
  const url = `https://api.twitter.com/graphql/${USER_TWEETS_QID}/UserTweets?${q}`

  let j = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await ensureGuestToken(attempt > 0)
    const r = await fetch(url, {
      headers: guestHeaders(token),
      signal: AbortSignal.timeout(25000),
    })
    const text = await r.text()
    if (r.status === 429 || /rate limit/i.test(text)) {
      await sleep(4000 * (attempt + 1))
      guestToken = null
      continue
    }
    if (!r.ok) {
      await sleep(800)
      continue
    }
    try {
      j = JSON.parse(text)
    } catch {
      continue
    }
    break
  }
  if (!j || (j.errors?.length && !j.data)) return []

  const posts = collectTweetsFromTimeline(
    j,
    handle,
    kol.displayName || handle,
  )
  const now = Date.now()
  const cutoff7 = now - WEEK_MS
  const sorted = posts
    .filter((p) => Number.isFinite(Date.parse(p.createdAt)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const recent = sorted.filter((p) => Date.parse(p.createdAt) >= cutoff7)
  if (recent.length) return recent.slice(0, PER_KOL_LIVE)
  // Guest often only exposes highlights — take newest real posts within ~4 months
  // so quieter KOLs still appear without flooding the feed with 2022–23 pins.
  const cutoff120 = now - 120 * 24 * 60 * 60 * 1000
  return sorted
    .filter((p) => Date.parse(p.createdAt) >= cutoff120)
    .slice(0, 2)
}

async function fetchTweetById(id) {
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const r = await fetch(`https://${host}/status/${id}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'vn-kol-radar/1.0',
        },
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const tw = j.tweet || j
      if (!tw || !tw.id) continue
      const author = tw.author || tw.user || {}
      const handle =
        author.screen_name || author.username || tw.screen_name || ''
      const media = []
      const m = tw.media
      if (m?.photos) {
        for (const p of m.photos) {
          if (p.url) media.push(p.url)
        }
      }
      if (Array.isArray(tw.media_extended)) {
        for (const x of tw.media_extended) {
          if (x.url) media.push(x.url)
        }
      }
      return {
        id: String(tw.id),
        handle: String(handle).replace(/^@/, ''),
        displayName: author.name || handle,
        text: decodeEntities(tw.text || tw.full_text || '').trim(),
        createdAt: new Date(
          tw.created_at || tw.createdAt || Date.now(),
        ).toISOString(),
        likes: Number(tw.likes || tw.favorite_count || 0) || 0,
        reposts: Number(tw.retweets || tw.retweet_count || 0) || 0,
        replies: Number(tw.replies || tw.reply_count || 0) || 0,
        views: Number(tw.views || tw.view_count || 0) || 0,
        media: [...new Set(media)].slice(0, 4),
        isReply: !!(tw.replying_to || tw.in_reply_to_status_id_str),
        url: tw.url || `https://x.com/${handle}/status/${tw.id}`,
        avatarLocal: `/avatars/${String(handle).replace(/^@/, '')}.jpg`,
        isSynthetic: false,
      }
    } catch {
      /* try next host */
    }
  }
  return null
}

/** Fallback: discover status IDs from profile via jina reader */
async function discoverStatusIds(handle) {
  const ids = new Set()
  try {
    const r = await fetch(`https://r.jina.ai/https://x.com/${handle}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'vn-kol-radar/1.0',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return []
    const j = await r.json()
    const content = String(j.data?.content || j.data?.text || '')
    const re = /status(?:es)?\/(\d{10,25})/gi
    let m
    while ((m = re.exec(content)) !== null) ids.add(m[1])
  } catch {
    /* ignore */
  }
  // Prefer newest snowflakes
  return [...ids]
    .sort((a, b) => {
      const da = snowflakeMs(a)
      const db = snowflakeMs(b)
      return (db || 0) - (da || 0)
    })
    .slice(0, 8)
}

async function fetchViaJinaFxtwitter(kol) {
  const handle = kol.handle
  const ids = await discoverStatusIds(handle)
  const posts = []
  for (const id of ids.slice(0, PER_KOL_LIVE + 2)) {
    const ms = snowflakeMs(id)
    if (Number.isFinite(ms) && ms < Date.now() - WEEK_MS) continue
    const tw = await fetchTweetById(id)
    await sleep(100)
    if (!tw) continue
    if (
      tw.handle &&
      tw.handle.toLowerCase() !== handle.toLowerCase()
    ) {
      continue
    }
    tw.handle = handle
    tw.displayName = kol.displayName || tw.displayName || handle
    tw.avatarLocal = `/avatars/${handle}.jpg`
    const t = Date.parse(tw.createdAt)
    if (Number.isFinite(t) && t < Date.now() - WEEK_MS) continue
    if (!tw.text) continue
    posts.push(tw)
    if (posts.length >= PER_KOL_LIVE) break
  }
  return posts
}

async function fetchLivePostsForKol(kol) {
  // Primary: X guest GraphQL timeline
  try {
    const viaGuest = await fetchViaGuestTimeline(kol)
    if (viaGuest.length) return viaGuest
  } catch {
    /* fallback */
  }
  // Fallback: jina + fxtwitter
  try {
    return await fetchViaJinaFxtwitter(kol)
  } catch {
    return []
  }
}

async function main() {
  const seedPath = path.join(ROOT, 'public/feed/tier1-feed.json')
  const prev = fs.existsSync(seedPath)
    ? loadJson(seedPath)
    : { posts: [], archivedPosts: [] }

  const snapshotPath = path.join(ROOT, 'data/kols-server-snapshot.json')
  // Prefer live API kols
  let kols = []
  try {
    const api =
      (process.env.RADAR_API_BASE || 'https://radar.daveynfts.com').replace(
        /\/$/,
        '',
      ) + '/api/kols'
    const r = await fetch(`${api}?t=${Date.now()}`, { cache: 'no-store' })
    if (r.ok) {
      const j = await r.json()
      if (Array.isArray(j.kols) && j.kols.length) kols = j.kols
    }
  } catch {
    /* snapshot fallback */
  }
  if (!kols.length && fs.existsSync(snapshotPath)) {
    kols = loadJson(snapshotPath).kols || []
  }

  const rankOrder = { challenger: 0, master: 1, diamond: 2 }
  const pool = kols
    .filter((k) => {
      if (k.hidden) return false
      return TOP_RANKS.has(getKolRank(k))
    })
    .sort(
      (a, b) =>
        (rankOrder[getKolRank(a)] ?? 9) - (rankOrder[getKolRank(b)] ?? 9) ||
        (b.score || 0) - (a.score || 0),
    )

  if (!pool.length) {
    console.error('No Challenger/Master/Diamond KOLs')
    process.exit(1)
  }
  console.log(
    'Pool Challenger+Master+Diamond (top 3 ranks):',
    pool.length,
    pool.map((k) => `${getKolRank(k)[0].toUpperCase()}:${k.handle}`).join(', '),
  )

  const allowed = new Set(pool.map((k) => k.handle.toLowerCase()))

  // 1) Archive old from previous feed; keep CM posts still in window
  const prevPosts = (prev.posts || []).filter((p) =>
    allowed.has(String(p.handle || '').toLowerCase()),
  )
  const otherPrev = (prev.posts || []).filter(
    (p) => !allowed.has(String(p.handle || '').toLowerCase()),
  )
  const prevArchived = prev.archivedPosts || []
  const { live: keptLive, archived: newlyArchived } = archiveSplit(prevPosts)
  // Non CM posts go to archive bucket too
  const { live: otherLive, archived: otherArch } = archiveSplit(otherPrev)

  const archById = new Map()
  for (const p of [...prevArchived, ...newlyArchived, ...otherArch, ...otherLive]) {
    archById.set(p.id, p)
  }

  const liveById = new Map()
  // Keep prior *real* posts unless --fresh rebuild
  if (!freshRebuild) {
    for (const p of keptLive) {
      if (!isSyntheticPost(p)) liveById.set(p.id, { ...p, isSynthetic: false })
    }
    console.log(
      `Kept ${liveById.size} prior real posts (dropped synthetic seeds)`,
    )
  } else {
    console.log('Fresh rebuild — not keeping prior live posts')
  }

  // 2) Live fetch
  let liveFetched = 0
  let liveFromNetwork = 0
  if (!noLive) {
    console.log('Fetching live tweets (guest GraphQL → jina/fx)…')
    try {
      await ensureGuestToken(true)
      console.log('  guest token ok')
    } catch (e) {
      console.warn('  guest token fail:', e.message || e)
    }
    for (let i = 0; i < pool.length; i++) {
      const kol = pool[i]
      process.stdout.write(`  [${i + 1}/${pool.length}] @${kol.handle}… `)
      try {
        const posts = await fetchLivePostsForKol(kol)
        let n = 0
        for (const p of posts) {
          const was = liveById.has(p.id)
          liveById.set(p.id, p)
          liveFromNetwork++
          if (!was) n++
        }
        liveFetched += n
        console.log(`+${n} new (${posts.length} fetched, real total ${[...liveById.values()].filter((p) => !isSyntheticPost(p)).length})`)
      } catch (e) {
        console.log('fail', e.message || e)
      }
      // Pace to avoid guest/GraphQL 429
      await sleep(900)
      if ((i + 1) % 10 === 0) {
        guestToken = null
        try {
          await ensureGuestToken(true)
        } catch {
          /* continue */
        }
        await sleep(1500)
      }
    }
  } else {
    console.log('Skipping live fetch (--no-live)')
  }

  // 3) Fill with synthetic if needed (never overwrite real)
  let i = 0
  let syntheticAdded = 0
  const daySalt = Number(
    new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  )
  while (liveById.size < TARGET_LIVE && i < 600) {
    const kol = pool[i % pool.length]
    const post = buildSynthetic(i + 1, kol, daySalt % 10000)
    const t = Date.parse(post.createdAt)
    if (
      Number.isFinite(t) &&
      t >= Date.now() - WEEK_MS &&
      !liveById.has(post.id)
    ) {
      liveById.set(post.id, post)
      syntheticAdded++
    }
    i++
  }

  // Hard live window: nothing older than LIVE_WINDOW_MS stays in posts[]
  const cutoffLive = Date.now() - LIVE_WINDOW_MS
  for (const [id, p] of [...liveById.entries()]) {
    const t = Date.parse(p.createdAt)
    if (Number.isFinite(t) && t < cutoffLive) {
      liveById.delete(id)
      archById.set(id, p)
    }
  }

  const livePosts = [...liveById.values()]
    .filter((p) => allowed.has(String(p.handle || '').toLowerCase()))
    // Real posts first, then by recency
    .sort((a, b) => {
      const ar = isSyntheticPost(a) ? 1 : 0
      const br = isSyntheticPost(b) ? 1 : 0
      if (ar !== br) return ar - br
      return b.createdAt.localeCompare(a.createdAt)
    })
  // Prefer reals; fill remainder with synthetic up to TARGET
  const reals = livePosts.filter((p) => !isSyntheticPost(p))
  const syns = livePosts.filter((p) => isSyntheticPost(p))
  let finalLive = [...reals, ...syns]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, TARGET_LIVE)

  // Top-up synthetic only inside 14d window if still short
  let fillI = 0
  const daySalt2 = Number(
    new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  )
  while (finalLive.length < TARGET_LIVE && fillI < 800) {
    const kol = pool[fillI % pool.length]
    const post = buildSynthetic(fillI + 9000, kol, (daySalt2 % 10000) + 3)
    const t = Date.parse(post.createdAt)
    if (
      Number.isFinite(t) &&
      t >= cutoffLive &&
      !finalLive.some((x) => x.id === post.id)
    ) {
      finalLive.push(post)
    }
    fillI++
  }
  finalLive = finalLive
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, TARGET_LIVE)

  const archivedPosts = [...archById.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const handles = [...new Set(finalLive.map((p) => p.handle))]
  const realCount = finalLive.filter((p) => !isSyntheticPost(p)).length

  const feed = {
    generatedAt: new Date().toISOString(),
    source: `admin · refresh Challenger+Master+Diamond · liveX=${realCount} new=${liveFetched} syn=${finalLive.length - realCount} · archive >14d`,
    mode: 'admin',
    tier: 1,
    ranks: ['challenger', 'master', 'diamond'],
    kolCount: handles.length,
    handles,
    postCount: finalLive.length,
    realPostCount: realCount,
    posts: finalLive,
    archivedPosts,
    archivedCount: archivedPosts.length,
  }

  fs.writeFileSync(seedPath, JSON.stringify(feed, null, 2) + '\n')
  fs.writeFileSync(
    path.join(ROOT, 'data/feed-server-snapshot.json'),
    JSON.stringify(feed, null, 2) + '\n',
  )

  console.log(
    'wrote seed',
    'posts',
    feed.postCount,
    'realX',
    realCount,
    'syn',
    feed.postCount - realCount,
    'archived',
    feed.archivedCount,
    'voices',
    feed.kolCount,
    'newLive',
    liveFetched,
    'networkHits',
    liveFromNetwork,
  )
  console.log(
    'range',
    finalLive[finalLive.length - 1]?.createdAt,
    '→',
    finalLive[0]?.createdAt,
  )

  // Publish to R2 via API
  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const apiBase = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')
  if (!token) {
    console.warn(
      'FEED_ADMIN_TOKEN missing — seed files only. Admin → Feed → Save (R2) to publish.',
    )
    return
  }
  const put = await fetch(`${apiBase}/api/feed`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(feed),
  })
  const body = await put.json().catch(() => ({}))
  console.log('PUT /api/feed', put.status, body)
  if (!put.ok) process.exit(1)
  console.log('Published feed to R2 — live map will pick it up.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
