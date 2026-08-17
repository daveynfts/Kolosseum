/**
 * Merge verified @scexofficial mentions (10–17 Aug 2026) into SCEX tracking.
 *
 * Source: X search
 *   @scexofficial since:2026-08-10 until:2026-08-18 filter:verified -from:scexofficial
 *   (+ to:scexofficial cross-check, no extra URLs)
 *   136 unique status URLs.
 *
 *   node scripts/merge_scex_blue_mentions_aug10_17.mjs
 *   node scripts/merge_scex_blue_mentions_aug10_17.mjs --seed-only
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

/** 136 unique verified mention URLs · 10–17/08/2026 */
const RAW = `
https://x.com/longphan73/status/2088482339206902171
https://x.com/Jerry94_HC/status/2088176216339791898
https://x.com/Chinwo2/status/2088176215937175883
https://x.com/cangg_l/status/2088174811579371617
https://x.com/Caccy_001/status/2088173951302140094
https://x.com/GujilRuipa/status/2088173224358268993
https://x.com/md_al96367/status/2088173077075308779
https://x.com/HVnS42442600/status/2088171964431298650
https://x.com/foxSlightly/status/2088171691562459392
https://x.com/iam_barron01/status/2088170905293779021
https://x.com/OGFIGO/status/2088170539445780782
https://x.com/Phuc50103413/status/2088170224109650310
https://x.com/alonewolff21/status/2088169672114147398
https://x.com/HeyMila2008/status/2088169347961573701
https://x.com/0xabyee/status/2088168810083950764
https://x.com/pjjin574832/status/2088168509880885353
https://x.com/Maviskrypt/status/2088168190043914498
https://x.com/duycao8655/status/2088167969839046885
https://x.com/Btcniumowang/status/2088165806580339169
https://x.com/Ghost_X_NFT/status/2088164947750457621
https://x.com/APEXIKARU/status/2088164521961508960
https://x.com/_Juliaweb3/status/2088164341719962045
https://x.com/LSXS_888/status/2088164158911176937
https://x.com/0xAifred/status/2088163737132015681
https://x.com/All3in4out/status/2088163589765075112
https://x.com/SebyCore/status/2088163279919050884
https://x.com/Jimmyyweb3/status/2088163209220112600
https://x.com/blackcap_eth/status/2088162725226827788
https://x.com/0x_Donatello/status/2088161258029617521
https://x.com/coinshooot/status/2088160741979566545
https://x.com/tofudestiny/status/2088160313812345125
https://x.com/Okada_DeFi0x/status/2088159757773525304
https://x.com/furan86999/status/2088159349109891503
https://x.com/BlueTigerX_/status/2088158825098392026
https://x.com/IceOnChainnn/status/2088158750955692065
https://x.com/destinydou_/status/2088156197983785252
https://x.com/tinkeryaz49/status/2088156029536379194
https://x.com/NalyMetaX/status/2088155450781098331
https://x.com/MasterX093/status/2088155077957816753
https://x.com/HEiMajesty/status/2088154978217021931
https://x.com/DipaWeb3/status/2088154014101938534
https://x.com/shoaib7929276/status/2088152993804038190
https://x.com/HunterSCBcrypto/status/2088152339165348276
https://x.com/phill76815/status/2088152021946028312
https://x.com/Ser_nelson/status/2088151380972220700
https://x.com/NKLinhzk/status/2088150776090935430
https://x.com/HBO_data/status/2088150207682773022
https://x.com/Yosefphr/status/2088149866996224122
https://x.com/ariell_xyz/status/2088149838647132241
https://x.com/biren888/status/2088148852369166721
https://x.com/0x_Sultan26/status/2088148567307526244
https://x.com/ShazeemiS/status/2088148124346855797
https://x.com/TopuWeb3/status/2088147685501247986
https://x.com/kengdaica/status/2088147473433063475
https://x.com/Web3_crynyx/status/2088146966454874334
https://x.com/0x_Naxium/status/2088146749085127153
https://x.com/Roseemadeit/status/2088146458658672941
https://x.com/OxZphAr/status/2088146158711660804
https://x.com/Trathoa/status/2088145790850199576
https://x.com/0xrichboy/status/2088145704506286251
https://x.com/MrDegenMax/status/2088145192604045319
https://x.com/cxmrondlls/status/2088144200810602900
https://x.com/Subit_Crypto/status/2088143757770170435
https://x.com/NeonVoid01/status/2088143693475926256
https://x.com/RifatOfficiall/status/2088142801238364609
https://x.com/Rafi_on_Chain/status/2088142636335153490
https://x.com/RosecryptoXx/status/2088142512015769828
https://x.com/1nxnn__/status/2088142285343265032
https://x.com/dang_duytan/status/2088142155500110107
https://x.com/nguyenthambt/status/2088141975140893061
https://x.com/alveejack1/status/2088141491428602276
https://x.com/ShahzadaJunaid0/status/2088141421127819643
https://x.com/0xDrRick/status/2088141246686466323
https://x.com/0x_JadeX/status/2088141205842665683
https://x.com/RmTusar/status/2088141014112612709
https://x.com/love_doge123/status/2088140620338782709
https://x.com/ukhan4603/status/2088140386426593391
https://x.com/ultracrypto78/status/2088140335528747185
https://x.com/Jimduizhang1/status/2088140202745421994
https://x.com/GpaAndy/status/2088139978815754620
https://x.com/eevvaa01/status/2088139876181168195
https://x.com/Anders_swift/status/2088139826650624505
https://x.com/RiceFarmerNFT/status/2088139809994993742
https://x.com/sahar1371ak/status/2088139684547317764
https://x.com/0xfablo/status/2088139423741297146
https://x.com/ikramulweb3/status/2088139295358132634
https://x.com/derrelreyhan/status/2088139244325998797
https://x.com/Habib_XYZ8/status/2088138790858838061
https://x.com/SCOTEX111/status/2088138332760875096
https://x.com/RRweb3/status/2088138240570331646
https://x.com/Chongkydudut/status/2088138081274827023
https://x.com/aduwaye77/status/2088137998768480370
https://x.com/0xRiRoyal/status/2088137923967537607
https://x.com/Brittney0009/status/2088137651672990118
https://x.com/tulipxbt/status/2088137574993031535
https://x.com/mr_naim_07/status/2088137565614510586
https://x.com/mtave0128/status/2088137481212592608
https://x.com/AkiraRyukyu/status/2088137334294511861
https://x.com/just_johnny4/status/2088137168480841775
https://x.com/abdulhakeemson0/status/2088137127884181558
https://x.com/0xKeng/status/2088136859532800326
https://x.com/DrPengu6/status/2088136816490631454
https://x.com/BlaqOnyemauche/status/2088136808924147991
https://x.com/0xZeXoR/status/2088136731891474619
https://x.com/Dzola17/status/2088136591235764618
https://x.com/MacroBombastic/status/2088136465234493861
https://x.com/Domingo_gou/status/2088135576235184259
https://x.com/0xLazyys/status/2088135568245104973
https://x.com/OnurSuBrk/status/2088134501033554291
https://x.com/Bency1749379/status/2088134020483743875
https://x.com/0xdaddy_hey/status/2088133424309751949
https://x.com/nft_acekings/status/2088132991155618266
https://x.com/evrendag1284/status/2088131801927790790
https://x.com/0xYdv_James/status/2088131725465423956
https://x.com/kingatod/status/2088131712815395154
https://x.com/tagsincos/status/2088131568288297037
https://x.com/Iamscott08/status/2088131175223005400
https://x.com/Zyllona/status/2088130777938620711
https://x.com/Maddere7/status/2088130121605726468
https://x.com/reduansheikh11/status/2088129812879794191
https://x.com/_Zing_X/status/2088129550551306322
https://x.com/akrWeb3/status/2088129360759050594
https://x.com/Junior_crypto_0/status/2088129148640268688
https://x.com/Ichaka_001/status/2088129013751357562
https://x.com/ShetolIslam/status/2088128769256992793
https://x.com/sandraaasol/status/2088128757806580038
https://x.com/kokondukwe/status/2088128740911902808
https://x.com/long67564752/status/2087492964784508992
https://x.com/Zeras_24/status/2087247835846828481
https://x.com/crypto_ninjas/status/2087134876386681289
https://x.com/Convictionvn/status/2087075999146185037
https://x.com/Convictionvn/status/2087072978878239126
https://x.com/Thao19872017/status/2087065119343902824
https://x.com/z1vex/status/2087023843705582076
https://x.com/RealFrontierX/status/2087023688386510894
https://x.com/drofin69/status/2087023344147402816
`

function parseList(blob) {
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
    })
  }
  return out
}

const LIST = parseList(RAW)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function snowflakeToIso(idStr) {
  try {
    const ms = Number((BigInt(idStr) >> 22n) + 1288834974657n)
    return new Date(ms).toISOString()
  } catch {
    return new Date().toISOString()
  }
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
  if (
    /\bscam\b|lua dao|rug\s*pull|\brug\b|sap san|phot scex/.test(t)
  )
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
          'User-Agent': 'vn-kol-radar/scex-blue-aug10-17',
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
        text: text || `@${handle} · mention SCEX (blue 10–17/08)`,
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
    text: `@${expectedHandle} · mention SCEX (blue 10–17/08, enrich failed)`,
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
  if (LIST.length !== 136) {
    console.warn('Expected 136 unique URLs, parsed', LIST.length)
  } else {
    console.log('parsed', LIST.length, 'unique status URLs')
  }

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
          updatedAt: remote.updatedAt,
        })
      }
    } else {
      console.warn('live GET', getRes.status, '— falling back to seed')
    }
  }

  const posts = Array.isArray(dataset.posts) ? [...dataset.posts] : []
  const actors = Array.isArray(dataset.actors) ? [...dataset.actors] : []

  const existingIds = new Set()
  for (const p of posts) {
    for (const id of statusIdsOf(p)) existingIds.add(id)
  }

  let addedPosts = 0
  let refreshed = 0
  let thin = 0
  const touched = new Set()
  const enrichByHandle = new Map()

  let i = 0
  for (const row of LIST) {
    i += 1
    process.stdout.write(
      `[${String(i).padStart(3)}/${LIST.length}] ${row.statusId} @${row.handle}… `,
    )
    const e = await enrichStatus(row.statusId, row.handle)
    if (!e) {
      console.log('skip (official/empty)')
      await sleep(120)
      continue
    }
    if (e.thin) thin++
    if (e.followers || e.displayName) {
      enrichByHandle.set(e.handle, {
        followers: e.followers || 0,
        displayName: e.displayName,
      })
    }

    const prev = posts.find((p) => statusIdsOf(p).has(e.id))
    const post = {
      id: `p_${e.id}`,
      handle: e.handle,
      url: e.url,
      text: e.text,
      postedAt: e.postedAt,
      sentiment: inferSentiment(e.text),
      hidden: false,
      notes: e.isReply
        ? 'blue verified mention 10–17/08 · reply'
        : 'blue verified mention 10–17/08',
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
      Object.assign(prev, post, {
        media: keepMedia && !(e.media && e.media.length) ? prev.media : post.media,
        notes: prev.notes?.includes('blue verified mention 10–17/08')
          ? prev.notes
          : [prev.notes, post.notes].filter(Boolean).join(' · ').slice(0, 400),
      })
      refreshed++
      console.log(e.thin ? 'refresh-thin' : 'refresh')
    } else {
      posts.push(post)
      existingIds.add(e.id)
      addedPosts++
      console.log(e.thin ? 'add-thin' : `add @${e.handle}`)
    }
    touched.add(e.handle)
    await sleep(160)
  }

  // Recount volume for touched handles; create missing actors
  for (const handle of touched) {
    const hPosts = posts.filter(
      (p) => String(p.handle).toLowerCase() === handle && !p.hidden,
    )
    const goc = hPosts.filter(
      (p) => !String(p.notes || '').includes('reply'),
    ).length
    const reply = hPosts.length - goc
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

    let actor = actors.find((a) => String(a.handle).toLowerCase() === handle)
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
        await sleep(100)
      }
      actor = {
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
        sourcedAt: '2026-08-17',
        tags: 'blue,verified,aug10-17',
        notes: 'Blue verified mention @scexofficial · 10–17/08/2026',
      }
      actors.push(actor)
    } else {
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
      actor.isWhitelisted = true
      if (!actor.radarPipeline || actor.radarPipeline === 'none') {
        actor.radarPipeline = 'candidate'
      }
      const tags = String(actor.tags || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      for (const t of ['blue', 'verified', 'aug10-17']) {
        if (!tags.includes(t)) tags.push(t)
      }
      actor.tags = tags.join(',')
    }
  }

  posts.sort(
    (a, b) =>
      new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  )

  dataset.posts = posts
  dataset.actors = actors
  dataset.asOf = '2026-08-17'
  dataset.updatedAt = new Date().toISOString()
  dataset.note = [
    String(dataset.note || '').replace(
      /\s*· Blue verified mentions 2026-08-10→2026-08-17[^.]*\.?/gi,
      '',
    ),
    `· Blue verified mentions 2026-08-10→2026-08-17: +${addedPosts} posts · ~${refreshed} refresh · ${touched.size} handles · 136 URLs.`,
  ]
    .filter(Boolean)
    .join(' ')

  const json = JSON.stringify(dataset, null, 2) + '\n'
  fs.writeFileSync(SEED, json, 'utf8')
  console.log('wrote', SEED)
  fs.writeFileSync(SEED2, json, 'utf8')
  console.log('wrote', SEED2)

  if (!seedOnly) {
    if (!token) {
      console.error('FEED_ADMIN_TOKEN missing — seeds written, skip PUT')
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
        parsed: LIST.length,
        addedPosts,
        refreshed,
        thin,
        handles: touched.size,
        totalPosts: posts.length,
        totalActors: actors.length,
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
