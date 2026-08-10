/**
 * Fetch Blue Verified mentions of SCEX (~last 7 days), merge into SCEX tracking, optional PUT.
 *
 *   node scripts/fetch_scex_blue_mentions_7d.mjs
 *   node scripts/fetch_scex_blue_mentions_7d.mjs --seed-only
 *   node scripts/fetch_scex_blue_mentions_7d.mjs --since=2026-07-27 --until=2026-08-04
 *
 * Uses X guest GraphQL SearchTimeline (queryId from fa0311 docs) + blue_verified filter.
 * Falls back to seeded status list if search fails.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SEED = path.join(ROOT, 'src/data/internal/scex-tracking.json')

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

const seedOnly = process.argv.includes('--seed-only')
const argSince = process.argv.find((a) => a.startsWith('--since='))?.slice(8)
const argUntil = process.argv.find((a) => a.startsWith('--until='))?.slice(8)

/** Default: last ~7 days ending today (UTC date from env "today" 2026-08-03) */
function defaultWindow() {
  const end = new Date()
  // until exclusive → tomorrow if we want include today posts in local research
  const until = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1))
  const since = new Date(until)
  since.setUTCDate(since.getUTCDate() - 7)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { since: fmt(since), until: fmt(until) }
}

const win = defaultWindow()
const SINCE = argSince || win.since
const UNTIL = argUntil || win.until

const X_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Known-good SearchTimeline queryId (fa0311 TwitterInternalAPIDocument) */
const SEARCH_QIDS = [
  'BGd0T_j7oVwlW5U79tO_0A',
  'gkjsKepM6gl_DmFUcTMAmA',
  'nK1dw4oV3k4w5Ttt2MfVlg',
]

const SEARCH_FEATURES = {
  rweb_video_screen_enabled: false,
  payments_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

/** Manual harvest backup (original posts found via live search research) */
const FALLBACK_STATUS_IDS = [
  // 10/08
  '2086736508170694737', // trhonbtc
  '2086687369118556623', // trhonbtc
  // 09/08
  '2086428547141513495', // trhonbtc
  '2086428143880114182', // bachkhoabnb
  '2086365032213000219', // bachkhoabnb
  '2086318727994421539', // Iam_T_HUY
  '2086293218996408748', // 0xkenyaz
  '2086273959532896592', // 0xDoraSol
  '2086266627516194819', // KT_BTC
  '2086246110859874338', // PhanXuanThang5
  '2086442617089499362', // vuntqn91
  '2086338985786548228', // ni_celeb
  '2086372403123482809', // trungmanict
  // 08/08
  '2086137991450476759', // DuyPhm91
  // 02/08
  '2083898577068453957', // Convictionvn
  '2083793578221089061', // Gynis_TAO
  '2083778107283280143', // WeTheIvy
  // 01/08
  '2083596836087210420', // GhostxWriterx
  '2083481311726203218', // emacrypto_vn
  '2083470288545820972', // WhalePiz
  '2083463653958029396', // MotohashiHub
  '2083427976298017245', // KT_BTC
  '2083421505812099123', // gm_upside
  '2083384723909620046', // catqpx
  // 31/07
  '2083095199295905976', // LeHuuQuangVinh
  // 29/07
  '2082506031301886255', // GhostxWriterx
  '2082469946303316438', // TyrSui
  '2082391572461822058', // verathai11
  '2082297982565978229', // geneticvnc
  // 28/07
  '2082052365931483155', // luong4101992
  '2082023185273458904', // phamduydong179
  '2081945304694481038', // HungTinh1993
  '2081943683063304622', // davidbnb68
  '2081950299296825656', // GhostxWriterx
  // 27/07
  '2081625848415699198', // mrtrinhcrypto
  '2082412999294566839', // DuyPhm91
]

const FALSE_POSITIVE = [
  /pok[eé]mon/i,
  /niantic/i,
  /wayfarer/i,
  /\$SPCX\b/i,
  /\bSPCX\b/,
  /SpaceX/i,
]

let guestToken = null

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function ensureGuest(force = false) {
  if (guestToken && !force) return guestToken
  const r = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${X_BEARER}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json()
  if (!j.guest_token) throw new Error('guest activate failed')
  guestToken = j.guest_token
  return guestToken
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
    Referer: 'https://x.com/search',
  }
}

function unwrapTweet(node) {
  if (!node || typeof node !== 'object') return null
  if (node.__typename === 'Tweet' || node.legacy) return node
  if (node.__typename === 'TweetWithVisibilityResults' && node.tweet)
    return node.tweet
  if (node.tweet) return unwrapTweet(node.tweet)
  if (node.result) return unwrapTweet(node.result)
  return null
}

function parseTweetNode(node) {
  const tw = unwrapTweet(node)
  if (!tw?.legacy) return null
  const leg = tw.legacy
  const id = String(tw.rest_id || leg.id_str || '')
  if (!id) return null
  if (leg.retweeted_status_result || /^RT @/i.test(leg.full_text || ''))
    return null
  const userRes = tw.core?.user_results?.result
  const ul = userRes?.legacy || {}
  const handle = String(ul.screen_name || '').replace(/^@/, '')
  if (!handle) return null
  if (handle.toLowerCase() === 'scexofficial') return null
  const text = String(leg.full_text || leg.text || '').trim()
  if (!text) return null
  if (FALSE_POSITIVE.some((re) => re.test(text))) return null
  // Must look like SCEX exchange mention
  if (
    !/@scexofficial/i.test(text) &&
    !/\bSCEX\b/i.test(text) &&
    !/sàn\s*scex/i.test(text)
  ) {
    return null
  }
  const blue =
    userRes?.is_blue_verified === true ||
    userRes?.legacy?.ext_is_blue_verified === true ||
    ul.verified === true
  let postedAt
  if (leg.created_at) postedAt = new Date(leg.created_at).toISOString()
  else {
    try {
      const ms = Number((BigInt(id) >> 22n) + 1288834974657n)
      postedAt = new Date(ms).toISOString()
    } catch {
      postedAt = new Date().toISOString()
    }
  }
  const media = []
  for (const m of leg.extended_entities?.media || leg.entities?.media || []) {
    if (m.media_url_https) media.push(m.media_url_https)
  }
  return {
    id,
    handle: handle.toLowerCase(),
    displayName: ul.name || handle,
    text,
    postedAt,
    likes: Number(leg.favorite_count || 0) || 0,
    reposts: Number(leg.retweet_count || 0) || 0,
    replies: Number(leg.reply_count || 0) || 0,
    views: Number(tw.views?.count || 0) || 0,
    media: [...new Set(media)].slice(0, 4),
    isReply: !!(leg.in_reply_to_status_id_str || leg.in_reply_to_user_id_str),
    followers: Number(ul.followers_count || 0) || 0,
    isBlue: blue,
    url: `https://x.com/${handle}/status/${id}`,
  }
}

function collectTweets(json) {
  const out = []
  const seen = new Set()
  function walk(o) {
    if (!o || typeof o !== 'object') return
    if (o.__typename === 'Tweet' || o.legacy?.full_text || o.legacy?.id_str) {
      const p = parseTweetNode(o)
      if (p && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }
    if (o.tweet_results) walk(o.tweet_results)
    if (o.result) walk(o.result)
    if (Array.isArray(o)) o.forEach(walk)
    else {
      for (const v of Object.values(o)) {
        if (v && typeof v === 'object') walk(v)
      }
    }
  }
  walk(json)
  return out
}

async function searchOnce(rawQuery, cursor) {
  const token = await ensureGuest()
  let lastErr = null
  for (const qid of SEARCH_QIDS) {
    const variables = {
      rawQuery,
      count: 40,
      querySource: 'typed_query',
      product: 'Latest',
    }
    if (cursor) variables.cursor = cursor
    const url =
      `https://twitter.com/i/api/graphql/${qid}/SearchTimeline?` +
      new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(SEARCH_FEATURES),
      })
    try {
      const r = await fetch(url, {
        headers: guestHeaders(token),
        signal: AbortSignal.timeout(25000),
      })
      const text = await r.text()
      if (r.status === 404) {
        lastErr = `404 ${qid}`
        continue
      }
      if (r.status === 429) {
        await sleep(3000)
        await ensureGuest(true)
        lastErr = '429'
        continue
      }
      if (!r.ok) {
        lastErr = `${r.status} ${text.slice(0, 120)}`
        continue
      }
      const j = JSON.parse(text)
      const posts = collectTweets(j)
      // next cursor
      let next = null
      const entries =
        j?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ||
        []
      for (const inst of entries) {
        for (const e of inst.entries || []) {
          if (
            e.entryId?.startsWith('cursor-bottom') ||
            e.content?.cursorType === 'Bottom'
          ) {
            next = e.content?.value || e.content?.itemContent?.value || null
          }
        }
      }
      return { posts, next, qid }
    } catch (e) {
      lastErr = e.message
    }
  }
  throw new Error(`SearchTimeline failed: ${lastErr}`)
}

async function searchWindow() {
  const queries = [
    `(@scexofficial OR "sàn SCEX" OR "SCEX Simulator" OR SCEX) filter:blue_verified -from:scexofficial since:${SINCE} until:${UNTIL}`,
    `(@scexofficial OR "sàn SCEX") -from:scexofficial since:${SINCE} until:${UNTIL}`,
  ]
  const byId = new Map()
  for (const q of queries) {
    console.log('Search:', q)
    let cursor = null
    for (let page = 0; page < 6; page++) {
      try {
        const { posts, next, qid } = await searchOnce(q, cursor)
        console.log(`  page ${page + 1} via ${qid}: +${posts.length}`)
        for (const p of posts) {
          if (!byId.has(p.id)) byId.set(p.id, p)
          else {
            const prev = byId.get(p.id)
            byId.set(p.id, {
              ...prev,
              ...p,
              isBlue: prev.isBlue || p.isBlue,
              media: p.media?.length ? p.media : prev.media,
            })
          }
        }
        if (!next || posts.length === 0) break
        cursor = next
        await sleep(400)
      } catch (e) {
        console.warn('  search page fail:', e.message)
        break
      }
    }
  }
  return [...byId.values()]
}

async function enrichStatus(statusId) {
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const r = await fetch(`https://${host}/status/${statusId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'vn-kol-radar/scex-blue-7d',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const tw = j.tweet || j
      if (!tw?.text && !tw?.full_text) continue
      const handle = String(
        tw.author?.screen_name || tw.user_info?.screen_name || tw.user_screen_name || '',
      )
        .replace(/^@/, '')
        .toLowerCase()
      if (!handle || handle === 'scexofficial') return null
      const text = String(tw.text || tw.full_text || '').trim()
      if (FALSE_POSITIVE.some((re) => re.test(text))) return null
      if (
        !/@scexofficial/i.test(text) &&
        !/\bSCEX\b/i.test(text) &&
        !/sàn\s*scex/i.test(text)
      )
        return null
      const media = []
      if (tw.media?.photos)
        for (const p of tw.media.photos) if (p.url) media.push(p.url)
      if (Array.isArray(tw.mediaURLs)) media.push(...tw.mediaURLs)
      if (Array.isArray(tw.media_extended))
        for (const x of tw.media_extended) if (x.url) media.push(x.url)
      let postedAt
      if (tw.created_at || tw.createdAt || tw.date)
        postedAt = new Date(tw.created_at || tw.createdAt || tw.date).toISOString()
      else {
        try {
          const ms = Number((BigInt(statusId) >> 22n) + 1288834974657n)
          postedAt = new Date(ms).toISOString()
        } catch {
          postedAt = new Date().toISOString()
        }
      }
      return {
        id: String(statusId),
        handle,
        displayName:
          tw.author?.name || tw.user_info?.name || tw.user_name || handle,
        text,
        postedAt,
        likes: Number(tw.likes || tw.favorite_count || 0) || 0,
        reposts: Number(tw.retweets || tw.retweet_count || 0) || 0,
        replies: Number(tw.replies || tw.reply_count || 0) || 0,
        views: Number(tw.views || tw.view_count || 0) || 0,
        media: [...new Set(media)].slice(0, 4),
        isReply: !!(tw.replying_to || tw.in_reply_to_status_id),
        followers: Number(
          tw.author?.followers || tw.user_info?.followers_count || 0,
        ),
        isBlue: null, // resolve later
        url: `https://x.com/${handle}/status/${statusId}`,
      }
    } catch {
      /* next */
    }
  }
  return null
}

async function resolveBlue(handle) {
  try {
    const token = await ensureGuest()
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
    if (!r.ok) return { blue: false, followers: 0, name: handle }
    const j = await r.json()
    const u = j?.data?.user?.result
    if (!u || u.__typename === 'UserUnavailable')
      return { blue: false, followers: 0, name: handle }
    return {
      blue: u.is_blue_verified === true,
      followers: Number(u.legacy?.followers_count || 0) || 0,
      name: u.legacy?.name || handle,
    }
  } catch {
    return { blue: false, followers: 0, name: handle }
  }
}

function guessSentiment(text) {
  const t = text.toLowerCase()
  if (/scam|lừa|rác|đểu|sập/.test(t)) return 'bearish'
  if (/lỗ|thuế|cảnh báo|rủi ro|rén/.test(t) && !/giải thưởng|top/.test(t))
    return 'neutral'
  if (
    /chúc mừng|bullish|tham gia|hợp tác|giải thưởng|tuyệt|ổn|mốc|ký kết|MOU|chiến|top/.test(
      t,
    )
  )
    return 'bullish'
  return 'bullish'
}

function mapToneToQuality(sent, followers, views, goc) {
  let q = 40
  if (sent === 'bullish') q += 12
  if (sent === 'bearish') q -= 8
  q += Math.min(25, Math.log10((followers || 1) + 10) * 8)
  q += Math.min(12, Math.log10((views || 1) + 10) * 3)
  if (goc >= 2) q += 4
  if (goc >= 4) q += 4
  return Math.round(Math.min(96, Math.max(18, q)))
}

async function main() {
  console.log(`Window since:${SINCE} until:${UNTIL} (until exclusive)`)
  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const base = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  let found = []
  try {
    found = await searchWindow()
    console.log('Search total raw:', found.length)
  } catch (e) {
    console.warn('Search window failed:', e.message)
  }

  // Enrich fallback IDs not already found
  const have = new Set(found.map((p) => p.id))
  for (const id of FALLBACK_STATUS_IDS) {
    if (have.has(id)) continue
    process.stdout.write(`  fallback enrich ${id}… `)
    const p = await enrichStatus(id)
    console.log(p ? `@${p.handle}` : 'skip')
    if (p) {
      found.push(p)
      have.add(id)
    }
    await sleep(200)
  }

  // Resolve blue for unknowns; filter blue only
  const bluePosts = []
  const blueCache = new Map()
  for (const p of found) {
    let blue = p.isBlue
    let followers = p.followers
    let displayName = p.displayName
    if (blue !== true) {
      if (!blueCache.has(p.handle)) {
        process.stdout.write(`  blue? @${p.handle}… `)
        const info = await resolveBlue(p.handle)
        blueCache.set(p.handle, info)
        console.log(info.blue ? 'YES' : 'no', info.followers)
        await sleep(200)
      }
      const info = blueCache.get(p.handle)
      blue = info.blue
      followers = followers || info.followers
      displayName = displayName || info.name
    }
    if (!blue) continue
    // window filter by postedAt
    const d = p.postedAt.slice(0, 10)
    if (d < SINCE || d >= UNTIL) continue
    bluePosts.push({
      ...p,
      isBlue: true,
      followers,
      displayName,
    })
  }

  console.log('Blue-verified posts in window:', bluePosts.length)
  const byHandle = new Map()
  for (const p of bluePosts) {
    if (!byHandle.has(p.handle)) byHandle.set(p.handle, [])
    byHandle.get(p.handle).push(p)
  }
  console.log('Unique blue handles:', byHandle.size)
  for (const [h, posts] of [...byHandle.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(
      `  @${h} ×${posts.length} fol=${posts[0].followers} · ${(posts[0].text || '').slice(0, 50).replace(/\n/g, ' ')}`,
    )
  }

  // Load dataset: prefer live R2
  let dataset = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  if (!seedOnly) {
    console.log('GET', `${base}/api/scex-tracking`)
    const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
    if (getRes.ok) {
      const remote = await getRes.json()
      if (remote?.posts && remote?.actors) {
        dataset = remote
        console.log('Using R2', {
          posts: remote.posts.length,
          actors: remote.actors.length,
        })
      }
    }
  }

  const posts = Array.isArray(dataset.posts) ? [...dataset.posts] : []
  const actors = Array.isArray(dataset.actors) ? [...dataset.actors] : []
  const existingIds = new Set()
  for (const p of posts) {
    const m = String(p.url || p.id || '').match(/(\d{5,25})/g)
    if (m) m.forEach((id) => existingIds.add(id))
    const id = String(p.id || '').replace(/^p_/, '')
    if (/^\d{5,25}$/.test(id)) existingIds.add(id)
  }

  let addedPosts = 0
  let newActors = 0
  let updatedActors = 0

  for (const [handle, hPosts] of byHandle) {
    const originals = hPosts.filter((p) => !p.isReply)
    const replies = hPosts.filter((p) => p.isReply)
    const goc = originals.length || (hPosts.length ? 1 : 0)
    const replyN = replies.length
    const views = hPosts.reduce((s, p) => s + (p.views || 0), 0)
    const followers = Math.max(...hPosts.map((p) => p.followers || 0), 0)
    // majority sentiment from original texts
    const texts = (originals.length ? originals : hPosts).map((p) => p.text)
    const sentiments = texts.map(guessSentiment)
    const sent =
      sentiments.filter((s) => s === 'bullish').length >=
      sentiments.length / 2
        ? 'bullish'
        : sentiments.includes('bearish')
          ? 'bearish'
          : 'neutral'

    let actor = actors.find((a) => String(a.handle).toLowerCase() === handle)
    if (!actor) {
      actor = {
        id: `a_${handle}`,
        handle,
        displayName: hPosts[0].displayName || handle,
        kind: 'kol',
        followers,
        reach7d: views,
        postsVolume: goc + replyN,
        qualityScore: mapToneToQuality(sent, followers, views, goc),
        sentiment: sent,
        isWhitelisted: true,
        notes: `Blue Verified · ${SINCE}→${UNTIL} · goc ${goc} · reply ${replyN}`,
        tags: `blue_verified,goc:${goc},reply:${replyN},${sent}`,
      }
      actors.push(actor)
      newActors++
    } else {
      actor.followers = Math.max(actor.followers || 0, followers)
      actor.reach7d = Math.max(actor.reach7d || 0, views)
      actor.postsVolume = Math.max(actor.postsVolume || 0, goc + replyN)
      actor.sentiment = sent
      actor.displayName = hPosts[0].displayName || actor.displayName
      actor.notes = [
        actor.notes,
        `Blue 7d ${SINCE}→${UNTIL} goc:${goc} reply:${replyN}`,
      ]
        .filter(Boolean)
        .join(' · ')
      if (!String(actor.tags || '').includes('blue_verified'))
        actor.tags = [actor.tags, 'blue_verified'].filter(Boolean).join(',')
      updatedActors++
    }

    for (const p of hPosts) {
      // Prefer original posts for feed; still include high-signal replies with @scexofficial
      if (p.isReply && !/@scexofficial/i.test(p.text) && p.text.length < 80)
        continue
      if (existingIds.has(p.id)) {
        // refresh text/media if thin
        const prev = posts.find(
          (x) =>
            String(x.id).replace(/^p_/, '') === p.id ||
            String(x.url || '').includes(p.id),
        )
        if (prev) {
          if (!prev.text || prev.text.length < 40) prev.text = p.text
          if ((!prev.media || !prev.media.length) && p.media?.length)
            prev.media = p.media
          prev.likes = p.likes ?? prev.likes
          prev.reposts = p.reposts ?? prev.reposts
          prev.replies = p.replies ?? prev.replies
          prev.views = p.views ?? prev.views
        }
        continue
      }
      existingIds.add(p.id)
      posts.push({
        id: `p_${p.id}`,
        handle,
        url: p.url,
        text: p.text,
        postedAt: p.postedAt,
        sentiment: guessSentiment(p.text),
        hidden: false,
        notes: `Blue Verified mention · since:${SINCE} until:${UNTIL}`,
        media: p.media || [],
        likes: p.likes,
        reposts: p.reposts,
        replies: p.replies,
        views: p.views,
      })
      addedPosts++
    }

    const handlePosts = posts
      .filter((x) => String(x.handle).toLowerCase() === handle)
      .sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
    if (handlePosts[0]) actor.lastPostAt = handlePosts[0].postedAt
  }

  posts.sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
  dataset.posts = posts
  dataset.actors = actors
  dataset.updatedAt = new Date().toISOString()
  dataset.asOf = new Date().toISOString().slice(0, 10)
  dataset.note = [
    String(dataset.note || ''),
    `Blue Verified mentions ${SINCE}→${UNTIL}: +${addedPosts} posts · +${newActors} actors · ~${updatedActors} upd · ${byHandle.size} blue handles.`,
  ]
    .filter(Boolean)
    .join(' · ')

  fs.writeFileSync(SEED, JSON.stringify(dataset, null, 2) + '\n')
  console.log('Seed written', {
    posts: posts.length,
    actors: actors.length,
    addedPosts,
    newActors,
    updatedActors,
  })

  if (seedOnly) {
    console.log('--seed-only: skip R2')
    return
  }
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing — seed only')
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
  const putText = await putRes.text()
  console.log('PUT', putRes.status, putText.slice(0, 400))
  if (!putRes.ok) process.exit(1)

  // Verify
  const v = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
  const got = await v.json()
  const weekPosts = (got.posts || []).filter((p) => {
    const d = String(p.postedAt || '').slice(0, 10)
    return d >= SINCE && d < UNTIL && String(p.handle).toLowerCase() !== 'scexofficial'
  })
  const handles = new Set(weekPosts.map((p) => String(p.handle).toLowerCase()))
  console.log('Verify window non-brand posts:', weekPosts.length, 'handles:', handles.size)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
