/**
 * Conviction side events — R2 first, then seed. Admin publishes via FEED_ADMIN_TOKEN.
 */
import {
  CONVICTION_EVENTS_SEED,
  normalizeDataset,
  type SideEventDataset,
} from '../data/convictionEvents'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const CACHE_KEY = 'vn-kol-map-conviction-events-v3'
export const CONVICTION_EVENTS_EVENT = 'vn-kol-conviction-events-updated'

function apiUrl() {
  return withBase('/api/event-side-events')
}

function emit() {
  try {
    window.dispatchEvent(new Event(CONVICTION_EVENTS_EVENT))
  } catch {
    /* ignore */
  }
}

function writeCache(dataset: SideEventDataset) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataset))
  } catch {
    /* ignore */
  }
  emit()
}

function readCache(): SideEventDataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return normalizeDataset(JSON.parse(raw))
  } catch {
    return null
  }
}

export function getConvictionEvents(): SideEventDataset {
  return readCache() || CONVICTION_EVENTS_SEED
}

export function seedConvictionEvents(): SideEventDataset {
  return normalizeDataset(
    JSON.parse(JSON.stringify(CONVICTION_EVENTS_SEED)),
  ) as SideEventDataset
}

export async function fetchServerEvents(): Promise<SideEventDataset | null> {
  try {
    const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    return normalizeDataset(await res.json())
  } catch {
    return null
  }
}

export type LoadEventsResult = {
  dataset: SideEventDataset
  source: 'server' | 'cache' | 'seed'
}

export async function loadEventsWithSource(): Promise<LoadEventsResult> {
  const server = await fetchServerEvents()
  if (server) {
    writeCache(server)
    return { dataset: server, source: 'server' }
  }
  const cache = readCache()
  if (cache) return { dataset: cache, source: 'cache' }
  return { dataset: seedConvictionEvents(), source: 'seed' }
}

export type EventsSaveResult =
  | { ok: true; dataset: SideEventDataset; updatedAt: string }
  | { ok: false; error: string; status?: number }

export async function saveEventsToServer(
  dataset: SideEventDataset,
  tokenOverride?: string,
): Promise<EventsSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return { ok: false, error: 'Missing FEED_ADMIN_TOKEN — Apply token first' }
  }

  let baseUpdatedAt: string | undefined
  try {
    const server = await fetchServerEvents()
    baseUpdatedAt = server?.updatedAt
  } catch {
    /* ignore */
  }

  const normalized = normalizeDataset({
    ...dataset,
    version: 1,
    kind: 'conviction-side-events',
    event: 'conviction-2026',
    updatedAt: new Date().toISOString(),
  })
  if (!normalized) {
    return { ok: false, error: 'Invalid dataset' }
  }

  const payload = {
    ...normalized,
    baseUpdatedAt,
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
          res.status === 401
            ? 'Unauthorized — kiểm tra FEED_ADMIN_TOKEN (Apply token rồi Save lại).'
            : res.status === 409
              ? j.message ||
                'Server có Events mới hơn — Reload rồi Save lại.'
              : j.message || j.error || res.statusText,
        status: res.status,
      }
    }
    const saved: SideEventDataset = {
      ...normalized,
      updatedAt: j.updatedAt || normalized.updatedAt,
    }
    writeCache(saved)
    return {
      ok: true,
      dataset: saved,
      updatedAt: saved.updatedAt,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function clearEventsCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

export function exportEventsJson(dataset: SideEventDataset): string {
  return JSON.stringify(normalizeDataset(dataset), null, 2)
}

export function importEventsJson(text: string): SideEventDataset {
  const n = normalizeDataset(JSON.parse(text))
  if (!n) throw new Error('Invalid Events JSON')
  return n
}
