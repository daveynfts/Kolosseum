/**
 * Upsert @scexofficial brand posts into SCEX tracking (seed + R2).
 *
 *   node scripts/update_scex_official_posts.mjs
 *   node scripts/update_scex_official_posts.mjs --seed-only
 */
import fs from 'fs'
import { adminPutJson } from './lib/adminPut.mjs'
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

/** ISO UTC from VN wall time (UTC+7) */
function vnToIso(y, m, d, hh, mm) {
  // VN local → UTC: subtract 7h
  const utc = Date.UTC(y, m - 1, d, hh - 7, mm, 0)
  return new Date(utc).toISOString()
}

/**
 * Official posts since:2026-07-27 until:2026-08-03 (until exclusive of 03/08)
 * Times are VN wall-clock as provided by research.
 */
const OFFICIAL_POSTS = [
  {
    id: '2083734533610885231',
    url: 'https://x.com/scexofficial/status/2083734533610885231',
    text: 'CHỈ CÒN 1 NGÀY!',
    postedAt: vnToIso(2026, 8, 2, 9, 0),
    notes: 'Official · CHỈ CÒN 1 NGÀY · since:2026-07-27 until:2026-08-03',
  },
  {
    id: '2083372149381669315',
    url: 'https://x.com/scexofficial/status/2083372149381669315',
    text: 'CHỈ CÒN 2 NGÀY!',
    postedAt: vnToIso(2026, 8, 1, 9, 0),
    notes: 'Official · CHỈ CÒN 2 NGÀY · since:2026-07-27 until:2026-08-03',
  },
  {
    id: '2083120067462705466',
    url: 'https://x.com/scexofficial/status/2083120067462705466',
    text: 'Checklist chặng nước rút',
    postedAt: vnToIso(2026, 7, 31, 16, 18),
    notes: 'Official · Checklist chặng nước rút · since:2026-07-27 until:2026-08-03',
  },
  {
    id: '2082458625214169277',
    url: 'https://x.com/scexofficial/status/2082458625214169277',
    text: 'Tổng kết Đấu trường sau 3 tuần',
    postedAt: vnToIso(2026, 7, 29, 20, 30),
    notes: 'Official · Tổng kết Đấu trường sau 3 tuần · since:2026-07-27 until:2026-08-03',
  },
  {
    id: '2082371403920400524',
    url: 'https://x.com/scexofficial/status/2082371403920400524',
    text: 'Công bố BXH tuần 3',
    postedAt: vnToIso(2026, 7, 29, 14, 43),
    notes: 'Official · Công bố BXH tuần 3 · since:2026-07-27 until:2026-08-03',
  },
  {
    id: '2081924512917115155',
    url: 'https://x.com/scexofficial/status/2081924512917115155',
    text: 'Điểm chung cuộc không chỉ từ giao dịch',
    postedAt: vnToIso(2026, 7, 28, 9, 7),
    notes: 'Official · Điểm chung cuộc không chỉ từ giao dịch · since:2026-07-27 until:2026-08-03',
  },
  {
    id: '2081575260126912874',
    url: 'https://x.com/scexofficial/status/2081575260126912874',
    text: 'Tuần quyết định bắt đầu',
    postedAt: vnToIso(2026, 7, 27, 9, 59),
    notes: 'Official · Tuần quyết định bắt đầu · since:2026-07-27 until:2026-08-03 · không có bài 30/07',
  },
]

function toScexPost(row, enrich = null) {
  const base = {
    id: `p_${row.id}`,
    handle: 'scexofficial',
    url: row.url,
    text: row.text,
    postedAt: row.postedAt,
    sentiment: 'bullish',
    hidden: false,
    notes: row.notes,
    media: [],
  }
  if (!enrich) return base
  return {
    ...base,
    text: (enrich.text || base.text).trim() || base.text,
    postedAt: enrich.postedAt || base.postedAt,
    media: Array.isArray(enrich.media) ? enrich.media : [],
    likes: enrich.likes,
    reposts: enrich.reposts,
    replies: enrich.replies,
    views: enrich.views,
  }
}

async function fetchEnrich(statusId) {
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const r = await fetch(`https://${host}/status/${statusId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'vn-kol-radar/scex-official',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const tw = j.tweet || j
      if (!tw?.id && !tw?.text) continue
      const media = []
      if (tw.media?.photos) {
        for (const p of tw.media.photos) if (p.url) media.push(p.url)
      }
      if (Array.isArray(tw.media_extended)) {
        for (const x of tw.media_extended) if (x.url) media.push(x.url)
      }
      let postedAt
      if (tw.created_at || tw.createdAt) {
        const d = new Date(tw.created_at || tw.createdAt)
        if (!Number.isNaN(d.getTime())) postedAt = d.toISOString()
      }
      return {
        text: String(tw.text || tw.full_text || '').trim(),
        postedAt,
        likes: Number(tw.likes || tw.favorite_count || 0) || undefined,
        reposts: Number(tw.retweets || tw.retweet_count || 0) || undefined,
        replies: Number(tw.replies || tw.reply_count || 0) || undefined,
        views: Number(tw.views || tw.view_count || 0) || undefined,
        media: [...new Set(media)].slice(0, 4),
      }
    } catch {
      /* next host */
    }
  }
  return null
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function mergeOfficial(dataset, { enrich = true } = {}) {
  const posts = Array.isArray(dataset.posts) ? [...dataset.posts] : []
  const byId = new Map(posts.map((p) => [String(p.id), p]))
  let added = 0
  let updated = 0
  for (const row of OFFICIAL_POSTS) {
    let enrichData = null
    if (enrich) {
      process.stdout.write(`  enrich ${row.id}… `)
      enrichData = await fetchEnrich(row.id)
      console.log(enrichData ? 'ok' : 'skip')
      await sleep(200)
    }
    const next = toScexPost(row, enrichData)
    const prev = byId.get(next.id)
    if (prev) {
      byId.set(next.id, {
        ...prev,
        ...next,
        media:
          Array.isArray(next.media) && next.media.length
            ? next.media
            : Array.isArray(prev.media) && prev.media.length
              ? prev.media
              : [],
        likes: next.likes ?? prev.likes,
        reposts: next.reposts ?? prev.reposts,
        replies: next.replies ?? prev.replies,
        views: next.views ?? prev.views,
        text: next.text || prev.text,
      })
      updated++
    } else {
      byId.set(next.id, next)
      added++
    }
  }
  const merged = [...byId.values()].sort((a, b) =>
    String(b.postedAt).localeCompare(String(a.postedAt)),
  )
  return {
    dataset: {
      ...dataset,
      updatedAt: new Date().toISOString(),
      asOf: new Date().toISOString().slice(0, 10),
      note: [
        dataset.note || '',
        `Official @scexofficial posts upsert since:2026-07-27 until:2026-08-03 (+${added}/~${updated} upd, 7 posts; no post 30/07).`,
      ]
        .filter(Boolean)
        .join(' · '),
      posts: merged,
    },
    added,
    updated,
  }
}

async function main() {
  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const base = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  let baseDataset = JSON.parse(fs.readFileSync(SEED, 'utf8'))

  if (!seedOnly) {
    console.log('GET', `${base}/api/scex-tracking`)
    const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
    if (getRes.ok) {
      const remote = await getRes.json()
      if (remote?.posts && remote?.actors) {
        baseDataset = remote
        console.log('Using live R2 dataset', {
          posts: remote.posts.length,
          actors: remote.actors.length,
        })
      }
    } else {
      console.warn('GET failed', getRes.status, '— using local seed')
    }
  }

  console.log('Enrich + merge official posts…')
  const { dataset, added, updated } = await mergeOfficial(baseDataset, {
    enrich: true,
  })
  fs.writeFileSync(SEED, JSON.stringify(dataset, null, 2) + '\n')
  console.log('Seed written', {
    posts: dataset.posts.length,
    added,
    updated,
    official: dataset.posts.filter(
      (p) => String(p.handle).toLowerCase() === 'scexofficial',
    ).length,
  })

  if (seedOnly) {
    console.log('--seed-only: skip R2')
    return
  }

  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing — seed only')
    process.exit(1)
  }

  const putRes = await adminPutJson(`${base}/api/scex-tracking`, token, dataset)
  const putText = await putRes.text()
  console.log('PUT', putRes.status, putText.slice(0, 400))
  if (!putRes.ok) process.exit(1)

  const v = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
  const got = await v.json()
  const off = (got.posts || []).filter(
    (p) => String(p.handle || '').toLowerCase() === 'scexofficial',
  )
  console.log('Verify official posts:', off.length)
  for (const p of off
    .slice()
    .sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
    .slice(0, 12)) {
    console.log(
      '-',
      p.postedAt,
      (p.text || '').slice(0, 48).replace(/\n/g, ' '),
      p.url || '',
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
