/**
 * SCEX tracking — R2 first, then seed. Admin publishes via FEED_ADMIN_TOKEN.
 */
import {
  SCEX_TRACKING_SEED,
  normalizeScexDataset,
  recomputeScexScores,
  type ScexDataset,
} from '../data/scexTracking'
import { withBase } from './base'
import { getAdminToken } from './feedStore'
import { loadKolsWithSource } from './kolStore'

const CACHE_KEY = 'vn-kol-map-scex-tracking-v1'
const PUBLIC_CACHE_KEY = 'vn-kol-map-scex-tracking-public-v1'
export const SCEX_TRACKING_EVENT = 'vn-kol-scex-tracking-updated'

function apiUrl() {
  return withBase('/api/scex-tracking')
}

function emit() {
  try {
    window.dispatchEvent(new Event(SCEX_TRACKING_EVENT))
  } catch {
    /* ignore */
  }
}

function writeCache(
  dataset: ScexDataset,
  emitEvent = true,
  includeHidden = false,
) {
  const key = includeHidden ? CACHE_KEY : PUBLIC_CACHE_KEY
  let prev: string | null = null
  try {
    prev = localStorage.getItem(key)
  } catch {
    prev = null
  }
  const next = JSON.stringify(dataset)
  try {
    localStorage.setItem(key, next)
  } catch {
    /* ignore */
  }
  // Same-tab load must not emit: ScexTrackingPage listens and would refetch forever.
  if (emitEvent && prev !== next) emit()
}

function readCache(includeHidden = false): ScexDataset | null {
  const keys = includeHidden
    ? [CACHE_KEY]
    : [PUBLIC_CACHE_KEY, CACHE_KEY]
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const ds = normalizeScexDataset(JSON.parse(raw))
      if (ds) return ds
    } catch {
      /* try next */
    }
  }
  return null
}

export function getScexDataset(): ScexDataset {
  return readCache() || SCEX_TRACKING_SEED
}

export function seedScexDataset(): ScexDataset {
  return normalizeScexDataset(
    JSON.parse(JSON.stringify(SCEX_TRACKING_SEED)),
  ) as ScexDataset
}

export async function fetchServerScex(opts?: {
  includeHidden?: boolean
}): Promise<ScexDataset | null> {
  const includeHidden = opts?.includeHidden === true
  const token = includeHidden ? getAdminToken().trim() : ''
  const qs = new URLSearchParams({ t: String(Date.now()) })
  if (includeHidden) qs.set('all', '1')
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiUrl()}?${qs}`, {
    method: 'GET',
    cache: 'no-store',
    headers,
  })
  if (res.status === 404 || res.status === 503) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return normalizeScexDataset(await res.json())
}

export type LoadScexResult = {
  dataset: ScexDataset
  source: 'server' | 'cache' | 'seed'
}

export async function loadScexWithSource(opts?: {
  includeHidden?: boolean
}): Promise<LoadScexResult> {
  const includeHidden = opts?.includeHidden === true
  try {
    const server = await fetchServerScex(opts)
    if (server) {
      writeCache(server, false, includeHidden)
      return { dataset: server, source: 'server' }
    }
  } catch {
    /* cache/seed */
  }
  const cache = readCache(includeHidden)
  if (cache) return { dataset: cache, source: 'cache' }
  return { dataset: seedScexDataset(), source: 'seed' }
}

export type ScexSaveResult =
  | { ok: true; dataset: ScexDataset; updatedAt: string }
  | { ok: false; error: string; status?: number }

export async function saveScexToServer(
  dataset: ScexDataset,
  note?: string,
  tokenOverride?: string,
): Promise<ScexSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return { ok: false, error: 'Missing FEED_ADMIN_TOKEN — Apply token first' }
  }

  let baseUpdatedAt: string | undefined
  try {
    const server = await fetchServerScex({ includeHidden: true })
    baseUpdatedAt = server?.updatedAt
  } catch {
    return {
      ok: false,
      error: 'Không đọc được bản server — thử lại trước khi Save.',
    }
  }

  let mapKols: { handle: string; rank?: string; tier?: number; score?: number }[] =
    []
  try {
    const k = await loadKolsWithSource({ includeHidden: true })
    mapKols = k.kols || []
  } catch {
    /* score without map join */
  }

  const payload = recomputeScexScores(
    {
      ...dataset,
      note: note ?? dataset.note,
      updatedAt: new Date().toISOString(),
      asOf: new Date().toISOString(),
      baseUpdatedAt,
    } as ScexDataset & { baseUpdatedAt?: string },
    mapKols,
  )
  const { baseUpdatedAt: _drop, ...toCache } = payload as ScexDataset & {
    baseUpdatedAt?: string
  }
  try {
    const res = await fetch(apiUrl(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const j = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
      updatedAt?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 409
            ? j.message ||
              'Server có SCEX mới hơn — Reload rồi Save lại.'
            : j.message || j.error || res.statusText,
        status: res.status,
      }
    }
    writeCache(toCache as ScexDataset, true, true)
    return {
      ok: true,
      dataset: toCache as ScexDataset,
      updatedAt: j.updatedAt || payload.updatedAt || new Date().toISOString(),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function clearScexCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(PUBLIC_CACHE_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

export function exportScexJson(dataset: ScexDataset): string {
  return JSON.stringify(recomputeScexScores(dataset), null, 2)
}

export function importScexJson(text: string): ScexDataset {
  const n = normalizeScexDataset(JSON.parse(text))
  if (!n) throw new Error('Invalid SCEX JSON')
  return n
}
