/**
 * Shared ops helpers for `scripts/radar.mjs`.
 * Keep one-shot push_*.mjs working; new work should go through the CLI.
 */
import { adminGetJson, adminPutJson } from './adminPut.mjs'

export function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
}

export function parseArgs(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      rest.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
        continue
      }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next != null && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      rest.push(a)
    }
  }
  return { flags, rest }
}

export function parseFollowerFile(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.followers)) return data.followers
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.list)) return data.list
  }
  throw new Error('Follower JSON must be an array or { followers: [] }')
}

function assertFollowerRow(row, i, type) {
  if (!row || typeof row !== 'object') {
    throw new Error(`followers[${i}] is not an object`)
  }
  const handle = normalizeHandle(row.handle)
  if (!handle) throw new Error(`followers[${i}] missing handle`)
  if (type === 'smart') {
    if (row.role == null && row.displayName == null) {
      throw new Error(`smart followers[${i}] @${handle} needs role or displayName`)
    }
  }
  return { ...row, handle }
}

export async function pushFollowers({
  apiBase,
  token,
  handle,
  type,
  rows,
  note,
}) {
  const key = normalizeHandle(handle)
  if (!key) throw new Error('--handle is required')
  if (type !== 'recent' && type !== 'smart') {
    throw new Error('--type must be recent or smart')
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Follower list is empty')
  }
  const list = rows.map((row, i) => assertFollowerRow(row, i, type))

  let current = { map: {}, smartMap: {} }
  try {
    current = await adminGetJson(`${apiBase}/api/recent-followers`, token)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('GET 404')) throw e
  }
  const map =
    current?.map && typeof current.map === 'object' ? { ...current.map } : {}
  const smartMap =
    current?.smartMap && typeof current.smartMap === 'object'
      ? { ...current.smartMap }
      : {}

  if (type === 'smart') {
    smartMap[key] = list
  } else {
    map[key] = list
  }

  const payload = {
    version: current?.version ?? 1,
    updatedAt: new Date().toISOString(),
    source: `admin server · radar CLI ${type} followers`,
    note: note || `Update ${type} followers for @${key}`,
    count: Object.keys(map).length,
    map,
    smartMap: Object.keys(smartMap).length ? smartMap : undefined,
  }

  const putRes = await adminPutJson(
    `${apiBase}/api/recent-followers`,
    token,
    payload,
  )
  const putBody = await putRes.json().catch(() => ({}))
  if (!putRes.ok) {
    const err = new Error(`PUT failed ${putRes.status}`)
    err.body = putBody
    throw err
  }
  return {
    handle: key,
    type,
    count: list.length,
    put: putBody,
  }
}

export async function hideKol({ apiBase, token, handle, unhide, note }) {
  const key = normalizeHandle(handle)
  if (!key) throw new Error('--handle is required')

  const payload = await adminGetJson(`${apiBase}/api/kols`, token)
  if (!payload?.kols?.length) throw new Error('No kols on server')

  const k = payload.kols.find(
    (x) => normalizeHandle(x.handle) === key || String(x.id || '') === key,
  )
  if (!k) throw new Error(`Handle not found on server: ${key}`)

  k.hidden = !unhide
  payload.updatedAt = new Date().toISOString()
  payload.note =
    note ||
    (unhide
      ? `admin · re-promote @${k.handle} to public map`
      : `admin · hide @${k.handle} from public map`)
  payload.source = 'admin server · radar CLI hide'
  payload.count = payload.kols.length
  payload.version = payload.version || 4

  const putRes = await adminPutJson(`${apiBase}/api/kols`, token, payload)
  const body = await putRes.json().catch(() => ({}))
  if (!putRes.ok) {
    const err = new Error(`PUT failed ${putRes.status}`)
    err.body = body
    throw err
  }
  return {
    handle: k.handle,
    hidden: k.hidden,
    put: body,
  }
}

export const HEALTH_ENDPOINTS = [
  { id: 'feed', path: '/api/feed', fields: ['generatedAt', 'updatedAt'] },
  { id: 'kols', path: '/api/kols', fields: ['updatedAt'] },
  { id: 'follows', path: '/api/recent-followers', fields: ['updatedAt'] },
  { id: 'scex', path: '/api/scex-tracking', fields: ['updatedAt', 'asOf'] },
  {
    id: 'reports',
    path: '/api/kol-reports',
    fields: ['updatedAt', 'asOf'],
  },
  {
    id: 'twitterscore',
    path: '/api/twitterscore-top100',
    fields: ['updatedAt', 'asOf'],
  },
  { id: 'banner', path: '/api/site-banner', fields: ['updatedAt'] },
  {
    id: 'events',
    path: '/api/event-side-events?list=1',
    fields: ['updatedAt'],
  },
]

export function pickTimestamp(body, fields) {
  if (!body || typeof body !== 'object') return null
  for (const f of fields) {
    const v = body[f]
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Date.parse(v))) {
      return v.trim()
    }
  }
  return null
}

export async function fetchHealth(apiBase, token) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const rows = []
  for (const spec of HEALTH_ENDPOINTS) {
    const url = spec.path.startsWith('http')
      ? spec.path
      : `${apiBase}${spec.path}${spec.path.includes('?') ? '&' : '?'}t=${Date.now()}`
    try {
      const res = await fetch(url, { headers, cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        rows.push({
          id: spec.id,
          path: spec.path,
          ok: false,
          status: res.status,
          error: body?.error || `HTTP ${res.status}`,
          timestamp: null,
        })
        continue
      }
      rows.push({
        id: spec.id,
        path: spec.path,
        ok: true,
        status: res.status,
        timestamp: pickTimestamp(body, spec.fields),
        error: null,
      })
    } catch (e) {
      rows.push({
        id: spec.id,
        path: spec.path,
        ok: false,
        status: 0,
        error: e instanceof Error ? e.message : String(e),
        timestamp: null,
      })
    }
  }
  return rows
}
