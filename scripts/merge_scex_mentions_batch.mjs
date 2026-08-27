/**
 * Merge SCEX mention URL lists (group A = @scexofficial, group B = keyword SCEX).
 *
 *   node scripts/merge_scex_mentions_batch.mjs
 *   node scripts/merge_scex_mentions_batch.mjs --seed-only
 */
import fs from 'fs'
import { adminGetJson, adminPutJson } from './lib/adminPut.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED = path.join(ROOT, 'src/data/internal/scex-tracking.json')
const SEED2 = path.join(ROOT, 'data/internal/scex-tracking.json')
const FILE_A = path.join(ROOT, 'scripts/data/scex-mentions-a.txt')
const FILE_B = path.join(ROOT, 'scripts/data/scex-mentions-b.txt')

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

function parseList(blob, group) {
  const re =
    /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d{5,25})/gi
  const out = []
  const seen = new Set()
  let m
  while ((m = re.exec(String(blob)))) {
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      handle: m[1].toLowerCase(),
      statusId: id,
      url: `https://x.com/${m[1]}/status/${id}`,
      group,
    })
  }
  return out
}

const LIST_A = parseList(fs.readFileSync(FILE_A, 'utf8'), 'mention')
const LIST_B = parseList(fs.readFileSync(FILE_B, 'utf8'), 'keyword')
const aIds = new Set(LIST_A.map((r) => r.statusId))
const LIST = [...LIST_A, ...LIST_B.filter((r) => !aIds.has(r.statusId))]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function snowflakeToIso(idStr) {
  try {
    const ms = Number((BigInt(idStr) >> 22n) + 1288834974657n)
    return new Date(ms).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function isEventTaskSpam(text) {
  return /^@xnxx_en\s+@scexofficial\s+@convictionvn\b/i.test(
    String(text || '').trim(),
  )
}

function foldVi(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function inferSentiment(text) {
  const raw = String(text || '').trim()
  if (raw.length < 8) return 'neutral'
  const t = foldVi(raw)
  if (/\bscam\b|lua dao|rug\s*pull|\brug\b|sap san|phot scex/.test(t))
    return 'scam'
  const hardNeg =
    /khong ra gi|qua rac|toan rac|rac qua|tranh xa|dung dung|canh bao scam|buc minh/.test(
      t,
    )
  const strongBull =
    /ky ket|hop tac|thoa thuan|mou\b|bat tay|chuc mung|nha tai tro|giai thuong|thuc day|chien luoc|partnership|sponsor|bullish|tich cuc|he sinh thai|dang cap|chinh thuc/.test(
      t,
    )
  const mildCrit =
    /lag|don so|non tre|ton dung luong|chua ho tro|cai thien|khong chiu noi|thac mac|chua tot|thanh khoan/.test(
      t,
    )
  const softBull =
    /tham gia|dang ky|thu nghiem|demo|giao dich tren|lai duoc|top \d|bxh|dau truong|giai thuong|ref_code|ma gioi thieu/.test(
      t,
    )
  if (hardNeg && !strongBull) return 'bearish'
  if (strongBull && !hardNeg) return 'bullish'
  if (strongBull && hardNeg) return 'neutral'
  if (mildCrit && !strongBull) return 'neutral'
  if (softBull && !hardNeg) return 'bullish'
  return 'neutral'
}

async function enrichStatus(statusId, expectedHandle) {
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const r = await fetch(`https://${host}/status/${statusId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'vn-kol-radar/scex-mentions-batch',
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
      if (!handle || handle === 'scexofficial') return null
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
        text: text || `@${handle} · SCEX mention`,
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
  return {
    id: String(statusId),
    handle: expectedHandle,
    displayName: expectedHandle,
    text: `@${expectedHandle} · SCEX mention (enrich failed)`,
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

function statusIdsOf(post) {
  const out = new Set()
  const id = String(post.id || '').replace(/^p_/, '')
  if (/^\d{5,25}$/.test(id)) out.add(id)
  const m = String(post.url || '').match(/(\d{5,25})/g)
  if (m) m.forEach((x) => out.add(x))
  return out
}

async function main() {
  console.log('parsed', {
    mentionA: LIST_A.length,
    keywordB: LIST_B.length,
    mergedUnique: LIST.length,
  })

  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const base = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  let dataset = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  if (!seedOnly && token) {
    try {
      const remote = await adminGetJson(`${base}/api/scex-tracking`, token)
      if (remote?.posts && remote?.actors) {
        dataset = remote
        console.log('Using R2 (admin slice)', {
          posts: remote.posts.length,
          actors: remote.actors.length,
          hidden: (remote.posts || []).filter((p) => p.hidden).length,
          updatedAt: remote.updatedAt,
        })
      }
    } catch (e) {
      console.warn('live GET failed — seed fallback', e.message || e)
    }
  }

  const posts = Array.isArray(dataset.posts) ? [...dataset.posts] : []
  const actors = Array.isArray(dataset.actors) ? [...dataset.actors] : []

  let addedPosts = 0
  let refreshed = 0
  let skippedSpam = 0
  let thin = 0
  const touched = new Set()
  const enrichByHandle = new Map()

  let i = 0
  for (const row of LIST) {
    i += 1
    process.stdout.write(
      `[${String(i).padStart(3)}/${LIST.length}] ${row.group} ${row.statusId} @${row.handle}… `,
    )
    const e = await enrichStatus(row.statusId, row.handle)
    if (!e) {
      console.log('skip (official/empty)')
      await sleep(80)
      continue
    }
    if (isEventTaskSpam(e.text)) {
      skippedSpam++
      console.log('skip (event-task spam)')
      await sleep(60)
      continue
    }
    if (e.thin) thin++
    if (e.followers || e.displayName) {
      enrichByHandle.set(e.handle, {
        followers: e.followers || 0,
        displayName: e.displayName,
      })
    }

    const tag =
      row.group === 'mention'
        ? 'mention @scexofficial'
        : 'keyword SCEX'
    const prev = posts.find((p) => statusIdsOf(p).has(e.id))
    const post = {
      id: `p_${e.id}`,
      handle: e.handle,
      url: e.url,
      text: e.text,
      postedAt: e.postedAt,
      sentiment: inferSentiment(e.text),
      hidden: false,
      notes: [
        tag,
        e.isReply ? 'reply' : '',
      ]
        .filter(Boolean)
        .join(' · '),
      media: e.media || [],
      likes: e.likes,
      reposts: e.reposts,
      replies: e.replies,
      views: e.views,
    }
    if (prev) {
      const keepMedia =
        Array.isArray(prev.media) &&
        prev.media.some((u) => /\/r2\/media\/|\/api\/media/i.test(String(u)))
      const keepHidden = prev.hidden === true && isEventTaskSpam(prev.text)
      Object.assign(prev, post, {
        hidden: keepHidden ? true : false,
        media:
          keepMedia && !(e.media && e.media.length) ? prev.media : post.media,
        notes: prev.notes?.includes(tag)
          ? prev.notes
          : [prev.notes, post.notes].filter(Boolean).join(' · ').slice(0, 400),
      })
      refreshed++
      console.log(e.thin ? 'refresh-thin' : 'refresh')
    } else {
      posts.push(post)
      addedPosts++
      console.log(e.thin ? 'add-thin' : `add @${e.handle}`)
    }
    touched.add(e.handle)
    await sleep(120)
  }

  for (const handle of touched) {
    const actor = actors.find((a) => String(a.handle).toLowerCase() === handle)
    const hPosts = posts.filter(
      (p) => String(p.handle).toLowerCase() === handle && !p.hidden,
    )
    const goc = hPosts.filter(
      (p) => !String(p.notes || '').includes('reply'),
    ).length
    const reply = Math.max(0, hPosts.length - goc)
    const views = hPosts.reduce((s, p) => s + (Number(p.views) || 0), 0)
    const last = [...hPosts].sort(
      (a, b) =>
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
    )[0]
    const sentiments = hPosts.map((p) => p.sentiment || 'neutral')
    const bull = sentiments.filter((s) => s === 'bullish').length
    const bear = sentiments.filter(
      (s) => s === 'bearish' || s === 'scam',
    ).length
    const sent =
      bear > bull && bear > 0
        ? 'bearish'
        : bull > 0 && bull >= sentiments.length / 2
          ? 'bullish'
          : 'neutral'
    const extra = enrichByHandle.get(handle)

    if (!actor) {
      let followers = extra?.followers || 0
      let displayName = extra?.displayName || handle
      if (!followers) {
        process.stdout.write(`  profile @${handle}… `)
        const u = await fetchFxUser(handle)
        console.log(u ? u.followers : 'skip')
        if (u) {
          followers = u.followers
          displayName = u.displayName || displayName
        }
        await sleep(80)
      }
      if (hPosts.length === 0) continue
      actors.push({
        id: `a_${handle}`,
        handle,
        displayName,
        kind: followers >= 3000 ? 'kol' : 'user',
        followers,
        reach7d: views,
        postsVolume: hPosts.length,
        gocPosts: goc,
        replyPosts: reply,
        qualityScore: 50,
        sentiment: sent,
        isWhitelisted: true,
        lastPostAt: last?.postedAt,
        radarPipeline: 'candidate',
        sourcedAt: new Date().toISOString().slice(0, 10),
        tags: 'scex-batch',
        notes: 'SCEX mention harvest',
      })
    } else if (hPosts.length > 0) {
      if (extra?.displayName) actor.displayName = extra.displayName
      if (extra?.followers && extra.followers > (actor.followers || 0)) {
        actor.followers = extra.followers
      }
      actor.gocPosts = goc
      actor.replyPosts = reply
      actor.postsVolume = hPosts.length
      actor.reach7d = Math.max(Number(actor.reach7d) || 0, views)
      actor.lastPostAt = last?.postedAt || actor.lastPostAt
      actor.sentiment = sent
      if (actor.isDenylisted) {
        /* keep denylist for spam-only accounts */
      } else {
        actor.isWhitelisted = true
      }
    }
  }

  posts.sort(
    (a, b) =>
      new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  )

  dataset.posts = posts
  dataset.actors = actors
  dataset.asOf = new Date().toISOString().slice(0, 10)
  dataset.updatedAt = new Date().toISOString()
  dataset.note = [
    String(dataset.note || '').replace(
      /\s*· SCEX mention harvest A\+B[^.]*\.?/gi,
      '',
    ),
    `· SCEX mention harvest A+B: +${addedPosts} posts · ~${refreshed} refresh · ${touched.size} handles · skipSpam ${skippedSpam}.`,
  ]
    .filter(Boolean)
    .join(' ')

  const json = JSON.stringify(dataset, null, 2) + '\n'
  fs.writeFileSync(SEED, json, 'utf8')
  fs.writeFileSync(SEED2, json, 'utf8')
  console.log('wrote seeds')

  if (!seedOnly) {
    if (!token) {
      console.error('FEED_ADMIN_TOKEN missing')
      process.exit(1)
    }
    const putRes = await adminPutJson(
      `${base}/api/scex-tracking`,
      token,
      dataset,
    )
    const putBody = await putRes.text()
    console.log('PUT', putRes.status, putBody.slice(0, 280))
    if (!putRes.ok) process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        addedPosts,
        refreshed,
        skippedSpam,
        thin,
        handles: touched.size,
        totalPosts: posts.length,
        totalActors: actors.length,
        hidden: posts.filter((p) => p.hidden).length,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
