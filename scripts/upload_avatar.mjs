/**
 * Upload / refresh avatar to R2 via PUT /api/avatar?handle=
 * Usage:
 *   node scripts/upload_avatar.mjs mingli0x
 *   node scripts/upload_avatar.mjs mingli0x --file public/avatars/mingli0x.jpg
 *   (empty body → server fetches from X)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function loadEnvFile(file) {
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
    ) {
      v = v.slice(1, -1)
    }
    if (v && (!process.env[k] || process.env[k] === '')) process.env[k] = v
  }
}

async function main() {
  loadEnvFile('.env.local')
  const handle = (process.argv[2] || '').replace(/^@/, '').trim()
  if (!handle) {
    console.error('Usage: node scripts/upload_avatar.mjs <handle> [--file path]')
    process.exit(1)
  }
  let file = null
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === '--file') file = process.argv[++i]
  }
  if (!file) {
    const local = path.join(ROOT, 'public/avatars', `${handle}.jpg`)
    if (fs.existsSync(local)) file = local
  }

  const token = (process.env.FEED_ADMIN_TOKEN || '').trim()
  if (!token) {
    console.error('FEED_ADMIN_TOKEN missing')
    process.exit(1)
  }
  const apiBase = (
    process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'
  ).replace(/\/$/, '')

  const url = `${apiBase}/api/avatar?handle=${encodeURIComponent(handle)}`
  /** @type {Buffer | undefined} */
  let body
  /** @type {Record<string, string>} */
  const headers = {
    Authorization: `Bearer ${token}`,
  }
  if (file) {
    body = fs.readFileSync(path.resolve(file))
    headers['Content-Type'] = 'image/jpeg'
    console.log('upload file', file, body.length)
  } else {
    console.log('server will fetch from X')
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: body ?? undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  console.log('PUT', res.status, json)
  if (!res.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
