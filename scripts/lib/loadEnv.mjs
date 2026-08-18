import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Load KEY=value from a dotenv file without overwriting existing env. */
export function loadEnvFile(file, root = ROOT) {
  const p = path.join(root, file)
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

export function loadRadarEnv() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.production.local')
}

export function adminToken() {
  return (process.env.FEED_ADMIN_TOKEN || '').trim()
}

export function apiBase() {
  return (
    process.env.RADAR_API_BASE ||
    process.env.VITE_SITE_URL ||
    'https://radar.daveynfts.com'
  ).replace(/\/$/, '')
}

export function requireToken() {
  const token = adminToken()
  if (!token) {
    throw new Error('FEED_ADMIN_TOKEN missing (.env.local or env)')
  }
  return token
}
