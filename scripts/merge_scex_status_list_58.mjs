/**
 * Merge curated status URL list (58 blue/mention harvest) into SCEX tracking.
 *
 *   node scripts/merge_scex_status_list_58.mjs
 *   node scripts/merge_scex_status_list_58.mjs --seed-only
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED = path.join(ROOT, 'src/data/internal/scex-tracking.json')
const SEED2 = path.join(ROOT, 'data/internal/scex-tracking.json')

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

/** Full list #1–58 from research (newest → oldest) */
const LIST = [
  { n: 1, id: '2083754280218173601', handle: 'qwarm1990' },
  { n: 2, id: '2083719794260685098', handle: 'nhavanhoa192' },
  { n: 3, id: '2083629010467364976', handle: 'trhonbtc' },
  { n: 4, id: '2083615913421820101', handle: 'buckgoe2403' },
  { n: 5, id: '2083548284711526501', handle: 'lucas_nguyen686' },
  { n: 6, id: '2083547958679949772', handle: 'duocpro1' },
  { n: 7, id: '2083511693926375770', handle: 'vinhdtrai' },
  { n: 8, id: '2083481614030630918', handle: '0xxxxeti' },
  { n: 9, id: '2083465823373631664', handle: 'huaviduc753' },
  { n: 10, id: '2083465344983924858', handle: 'boehmemargarete' },
  { n: 11, id: '2083464560825266326', handle: 'nicolablackwo12' },
  { n: 12, id: '2083463141124669763', handle: 'alpharisen01' },
  { n: 13, id: '2083442690377838777', handle: 'solotop999' },
  { n: 14, id: '2083441636428980450', handle: 'iakweb3' },
  { n: 15, id: '2083440569339314313', handle: 'kaibgr' },
  { n: 16, id: '2083439778243174434', handle: 'lily_6886' },
  { n: 17, id: '2083438846231093635', handle: 'nglacr' },
  { n: 18, id: '2083434674316353898', handle: 'tannnnnnn2022' },
  { n: 19, id: '2083433901360644291', handle: 'eternals_io' },
  { n: 20, id: '2083433591514812448', handle: 'linh180796' },
  { n: 21, id: '2083432180970369122', handle: 'nhunglora9x' },
  { n: 22, id: '2083429944496111703', handle: 'martinho99999' },
  { n: 23, id: '2083429436092043710', handle: 'hoanghai889999' },
  { n: 24, id: '2083429374372561016', handle: 'btcvicky8386' },
  { n: 25, id: '2083428861807923509', handle: '1kaiweb3' },
  { n: 26, id: '2083428534769651810', handle: 'bearcrypto2021' },
  { n: 27, id: '2083428245505294643', handle: 'kaisenview' },
  { n: 28, id: '2083427976298017245', handle: 'kt_btc' },
  { n: 29, id: '2083423586782699902', handle: 'jackker123' },
  { n: 30, id: '2083420769745539504', handle: 'jackker123' },
  { n: 31, id: '2083095199295905976', handle: 'lehuuquangvinh' },
  { n: 32, id: '2082997625025081432', handle: 'lovingcb1' },
  { n: 33, id: '2082840734269596115', handle: 'mirajinkonino24' },
  { n: 34, id: '2082710121734713702', handle: 'deekay_btc' },
  { n: 35, id: '2082699366071234676', handle: 'dolianft' },
  { n: 36, id: '2082515038074769683', handle: '0xzhao888' },
  { n: 37, id: '2082500830306148834', handle: '0x0217' },
  { n: 38, id: '2082475051216245106', handle: 'dungtudau' },
  { n: 39, id: '2082469946303316438', handle: 'tyrsui' },
  { n: 40, id: '2082464951420264804', handle: 'billymcgrath24' },
  { n: 41, id: '2082413862352306341', handle: 'psnguyen1211' },
  { n: 42, id: '2082410017639260505', handle: 'ni_celeb' },
  { n: 43, id: '2082392485318603165', handle: 'vldn2025' },
  { n: 44, id: '2082371590780793145', handle: 'deekay_btc' },
  { n: 45, id: '2082145415210860815', handle: 'machiyanft' },
  { n: 46, id: '2082103074739638568', handle: 'luong4101992' },
  { n: 47, id: '2082078098540142612', handle: 'luong4101992' },
  { n: 48, id: '2082066903762424298', handle: 'luong4101992' },
  { n: 49, id: '2082064851422306485', handle: 'tdcryptovn' },
  { n: 50, id: '2082059451968978989', handle: 'luong4101992' },
  { n: 51, id: '2082057777024061730', handle: 'luong4101992' },
  { n: 52, id: '2082055032569315731', handle: 'thanphu656' },
  { n: 53, id: '2082054842961506340', handle: 'dungtudau' },
  { n: 54, id: '2082054683053674832', handle: 'luong4101992' },
  { n: 55, id: '2082053470597628297', handle: 'memorypaperweb' },
  { n: 56, id: '2082052681506648068', handle: 'thanphu656' },
  { n: 57, id: '2082052365931483155', handle: 'luong4101992' },
  { n: 58, id: '2081929513618018513', handle: 'thangonton' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function snowflakeToIso(idStr) {
  try {
    const ms = Number((BigInt(idStr) >> 22n) + 1288834974657n)
    return new Date(ms).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function guessSentiment(text) {
  const t = String(text || '').toLowerCase()
  if (/scam|lừa|rác|đểu|sập/.test(t)) return 'bearish'
  if (/lỗ|thuế|cảnh báo|rủi ro|rén|ghét/.test(t) && !/giải thưởng|top|chúc/.test(t))
    return 'neutral'
  if (
    /chúc mừng|bullish|tham gia|hợp tác|giải thưởng|tuyệt|ổn|mốc|ký kết|mou|chiến|top|cảm ơn|ok|đúng|hay|chi tiết/.test(
      t,
    )
  )
    return 'bullish'
  return 'neutral'
}

async function enrichStatus(statusId, expectedHandle) {
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const r = await fetch(`https://${host}/status/${statusId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'vn-kol-radar/scex-list58',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const tw = j.tweet || j
      const handle = String(
        tw.author?.screen_name ||
          tw.user_info?.screen_name ||
          tw.user_screen_name ||
          expectedHandle ||
          '',
      )
        .replace(/^@/, '')
        .toLowerCase()
      if (!handle) continue
      if (handle === 'scexofficial') return null
      const text = String(tw.text || tw.full_text || '').trim()
      const media = []
      if (tw.media?.photos)
        for (const p of tw.media.photos) if (p.url) media.push(p.url)
      if (Array.isArray(tw.mediaURLs)) media.push(...tw.mediaURLs)
      if (Array.isArray(tw.media_extended))
        for (const x of tw.media_extended) if (x.url) media.push(x.url)
      let postedAt
      if (tw.created_at || tw.createdAt || tw.date) {
        const d = new Date(tw.created_at || tw.createdAt || tw.date)
        if (!Number.isNaN(d.getTime())) postedAt = d.toISOString()
      }
      if (!postedAt) postedAt = snowflakeToIso(statusId)
      return {
        id: String(statusId),
        handle,
        displayName:
          tw.author?.name || tw.user_info?.name || tw.user_name || handle,
        text: text || `@${handle} · mention SCEX (list58 #)`,
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
        url: `https://x.com/${handle}/status/${statusId}`,
      }
    } catch {
      /* next host */
    }
  }
  // minimal fallback from snowflake + handle
  return {
    id: String(statusId),
    handle: expectedHandle,
    displayName: expectedHandle,
    text: `@${expectedHandle} · mention SCEX (list58, enrich failed)`,
    postedAt: snowflakeToIso(statusId),
    likes: 0,
    reposts: 0,
    replies: 0,
    views: 0,
    media: [],
    isReply: false,
    followers: 0,
    url: `https://x.com/${expectedHandle}/status/${statusId}`,
    thin: true,
  }
}

async function fetchFxUser(handle) {
  try {
    const r = await fetch(`https://api.fxtwitter.com/${handle}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return null
    const j = await r.json()
    const u = j.user || {}
    return {
      followers: Number(u.followers || 0) || 0,
      displayName: u.name || handle,
    }
  } catch {
    return null
  }
}

function qualityScore(followers, goc, reply, views, sent) {
  const posts = Math.max(1, goc + reply)
  const viewsPerPost = views / posts
  let q = 32 + Math.min(36, Math.log10(viewsPerPost + 10) * 12)
  q += Math.min(20, Math.log10((followers || 1) + 10) * 6)
  if (sent === 'bullish') q += 8
  if (sent === 'bearish') q -= 6
  if (goc >= 2) q += 3
  if (goc >= 5) q += 4
  return Math.round(Math.min(96, Math.max(18, q)))
}

async function main() {
  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const base = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

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

  const enriched = []
  for (const row of LIST) {
    process.stdout.write(`#${String(row.n).padStart(2)} ${row.id}… `)
    if (existingIds.has(row.id)) {
      console.log('already')
      // still enrich for refresh of thin text if needed
      const prev = posts.find(
        (x) =>
          String(x.id || '').includes(row.id) ||
          String(x.url || '').includes(row.id),
      )
      if (prev && (!prev.text || prev.text.length < 30 || /list58|export|mention SCEX \(export/i.test(prev.text))) {
        const e = await enrichStatus(row.id, row.handle)
        if (e && !e.thin) {
          prev.text = e.text
          prev.media = e.media?.length ? e.media : prev.media
          prev.likes = e.likes ?? prev.likes
          prev.views = e.views ?? prev.views
          prev.reposts = e.reposts ?? prev.reposts
          prev.replies = e.replies ?? prev.replies
          console.log('  refreshed')
        }
        await sleep(150)
      }
      continue
    }
    const e = await enrichStatus(row.id, row.handle)
    console.log(e.thin ? 'thin' : `@${e.handle}`)
    enriched.push({ ...e, listN: row.n })
    await sleep(180)
  }

  let addedPosts = 0
  let newActors = 0
  let updatedActors = 0
  const byHandle = new Map()

  for (const e of enriched) {
    const h = e.handle.toLowerCase()
    if (!byHandle.has(h)) byHandle.set(h, [])
    byHandle.get(h).push(e)

    if (existingIds.has(e.id)) continue
    existingIds.add(e.id)
    posts.push({
      id: `p_${e.id}`,
      handle: h,
      url: e.url,
      text: e.text,
      postedAt: e.postedAt,
      sentiment: guessSentiment(e.text),
      hidden: false,
      notes: `list58 #${e.listN} · curated SCEX mention harvest`,
      media: e.media || [],
      likes: e.likes,
      reposts: e.reposts,
      replies: e.replies,
      views: e.views,
    })
    addedPosts++
  }

  // Also group already-present list items for actor volume bump
  for (const row of LIST) {
    const h = row.handle.toLowerCase()
    if (!byHandle.has(h)) byHandle.set(h, [])
    // count list membership even if post already existed
  }

  // count posts per handle from full posts array for volume
  for (const [handle] of byHandle) {
    const hPosts = posts.filter((p) => String(p.handle).toLowerCase() === handle)
    const listPosts = LIST.filter((r) => r.handle === handle)
    // originals heuristic: longer text or not starting as bare reply fragment
    const goc = Math.max(
      1,
      hPosts.filter((p) => (p.text || '').length > 80 || !p.notes?.includes('list58')).length
        ? hPosts.length
        : listPosts.length,
    )
    // simpler: postsVolume = count of posts for handle in dataset
    const vol = hPosts.length
    const views = hPosts.reduce((s, p) => s + (Number(p.views) || 0), 0)
    const sentiments = hPosts.map((p) => p.sentiment || guessSentiment(p.text))
    const sent =
      sentiments.filter((s) => s === 'bullish').length >= sentiments.length / 2
        ? 'bullish'
        : sentiments.includes('bearish')
          ? 'bearish'
          : 'neutral'

    let followers = 0
    let displayName = handle
    const fromEnrich = enriched.find((e) => e.handle === handle)
    if (fromEnrich?.followers) followers = fromEnrich.followers
    if (fromEnrich?.displayName) displayName = fromEnrich.displayName

    let actor = actors.find((a) => String(a.handle).toLowerCase() === handle)
    if (!actor) {
      if (!followers) {
        process.stdout.write(`  profile @${handle}… `)
        const u = await fetchFxUser(handle)
        console.log(u ? u.followers : 'skip')
        if (u) {
          followers = u.followers
          displayName = u.displayName || displayName
        }
        await sleep(120)
      }
      actor = {
        id: `a_${handle}`,
        handle,
        displayName,
        kind: 'kol',
        followers,
        reach7d: views,
        postsVolume: vol,
        qualityScore: qualityScore(followers, vol, 0, views, sent),
        sentiment: sent,
        isWhitelisted: true,
        notes: `list58 · ${listPosts.length} link(s) · posts in feed ${vol}`,
        tags: `list58,goc:${vol},${sent}`,
      }
      actors.push(actor)
      newActors++
    } else {
      if (!followers && !actor.followers) {
        const u = await fetchFxUser(handle)
        if (u) {
          followers = u.followers
          displayName = u.displayName || displayName
        }
        await sleep(100)
      }
      actor.followers = Math.max(actor.followers || 0, followers)
      actor.reach7d = Math.max(actor.reach7d || 0, views)
      actor.postsVolume = Math.max(actor.postsVolume || 0, vol)
      if (displayName && displayName !== handle) actor.displayName = displayName
      actor.notes = [actor.notes, `list58 +${listPosts.length} links`].filter(Boolean).join(' · ')
      if (!String(actor.tags || '').includes('list58'))
        actor.tags = [actor.tags, 'list58'].filter(Boolean).join(',')
      updatedActors++
    }

    hPosts.sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
    if (hPosts[0]) actor.lastPostAt = hPosts[0].postedAt
  }

  posts.sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
  dataset.posts = posts
  dataset.actors = actors
  dataset.updatedAt = new Date().toISOString()
  dataset.asOf = new Date().toISOString().slice(0, 10)
  dataset.note = [
    String(dataset.note || ''),
    `list58 curated mentions: +${addedPosts} posts · +${newActors} actors · ~${updatedActors} actor upd · ${LIST.length} links.`,
  ]
    .filter(Boolean)
    .join(' · ')

  const json = JSON.stringify(dataset, null, 2) + '\n'
  fs.writeFileSync(SEED, json)
  if (fs.existsSync(path.dirname(SEED2))) {
    try {
      fs.writeFileSync(SEED2, json)
    } catch {
      /* optional */
    }
  }

  console.log('Seed written', {
    posts: posts.length,
    actors: actors.length,
    addedPosts,
    newActors,
    updatedActors,
  })

  // verify coverage of list
  let covered = 0
  for (const row of LIST) {
    if (
      posts.some(
        (p) =>
          String(p.id || '').includes(row.id) ||
          String(p.url || '').includes(row.id),
      )
    )
      covered++
  }
  console.log(`List coverage: ${covered}/${LIST.length}`)

  if (seedOnly) {
    console.log('--seed-only: skip R2')
    return
  }
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }

  const putRes = await adminPutJson(`${base}/api/scex-tracking`, token, dataset)
  console.log('PUT', putRes.status, (await putRes.text()).slice(0, 300))
  if (!putRes.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
