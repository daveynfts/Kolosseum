/**
 * Soft-hide SCEX event-task spam replies:
 *   @XNXX_EN @scexofficial @Convictionvn …
 *
 *   node scripts/hide_scex_event_task_spam.mjs
 *   node scripts/hide_scex_event_task_spam.mjs --seed-only
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

function isSpam(text) {
  return /^@xnxx_en\s+@scexofficial\s+@convictionvn\b/i.test(
    String(text || '').trim(),
  )
}

async function main() {
  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  const base = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  let dataset = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  if (!seedOnly) {
    const getRes = await fetch(`${base}/api/scex-tracking?t=${Date.now()}`)
    if (getRes.ok) {
      const remote = await getRes.json()
      if (remote?.posts && remote?.actors) dataset = remote
    }
  }

  const posts = Array.isArray(dataset.posts) ? [...dataset.posts] : []
  const actors = Array.isArray(dataset.actors) ? [...dataset.actors] : []

  let hiddenN = 0
  const touched = new Set()
  for (const p of posts) {
    if (!isSpam(p.text)) continue
    if (!p.hidden) hiddenN++
    p.hidden = true
    p.notes = [p.notes, 'hidden:event-task-spam @XNXX_EN cluster']
      .filter(Boolean)
      .join(' · ')
      .slice(0, 400)
    if (p.handle) touched.add(String(p.handle).toLowerCase())
  }

  let droppedActors = 0
  let keptMixed = 0
  for (const handle of touched) {
    const actor = actors.find((a) => String(a.handle).toLowerCase() === handle)
    if (!actor) continue
    const visible = posts.filter(
      (p) => String(p.handle).toLowerCase() === handle && !p.hidden,
    )
    const goc = visible.filter(
      (p) => !String(p.notes || '').includes('reply'),
    ).length
    const reply = visible.length - goc
    actor.gocPosts = goc
    actor.replyPosts = reply
    actor.postsVolume = visible.length
    if (visible.length === 0) {
      actor.isWhitelisted = false
      actor.isDenylisted = true
      actor.radarPipeline = 'rejected'
      actor.radarNote = 'Event-task spam cluster @XNXX_EN @scexofficial @Convictionvn'
      actor.tags = [actor.tags, 'spam', 'event-task']
        .filter(Boolean)
        .join(',')
        .replace(/^,|,$/g, '')
      droppedActors++
    } else {
      keptMixed++
      const last = [...visible].sort(
        (a, b) =>
          new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      )[0]
      actor.lastPostAt = last?.postedAt || actor.lastPostAt
    }
  }

  dataset.posts = posts
  dataset.actors = actors
  dataset.updatedAt = new Date().toISOString()
  dataset.note = [
    String(dataset.note || '').replace(
      /\s*· Hidden event-task spam[^.]*\.?/gi,
      '',
    ),
    `· Hidden event-task spam @XNXX_EN @scexofficial @Convictionvn: ${hiddenN} posts · ${droppedActors} actors denylisted.`,
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
      { hiddenN, droppedActors, keptMixed, posts: posts.length, actors: actors.length },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
