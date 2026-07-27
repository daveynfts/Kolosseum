/**
 * SCEX tracking — R2 first, then seed. Admin publishes via FEED_ADMIN_TOKEN.
 */
import {
  SCEX_TRACKING_SEED,
  normalizeScexDataset,
  recomputeScexActors,
  type ScexDataset,
} from '../data/scexTracking'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const CACHE_KEY = 'vn-kol-map-scex-tracking-v1'
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

function writeCache(dataset: ScexDataset) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataset))
  } catch {
    /* ignore */
  }
  emit()
}

function readCache(): ScexDataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return normalizeScexDataset(JSON.parse(raw))
  } catch {
    return null
  }
}

export function getScexDataset(): ScexDataset {
  return readCache() || SCEX_TRACKING_SEED
}

export function seedScexDataset(): ScexDataset {
  return normalizeScexDataset(
    JSON.parse(JSON.stringify(SCEX_TRACKING_SEED)),
  ) as ScexDataset
}

export async function fetchServerScex(): Promise<ScexDataset | null> {
  try {
    const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    return normalizeScexDataset(await res.json())
  } catch {
    return null
  }
}

export type LoadScexResult = {
  dataset: ScexDataset
  source: 'server' | 'cache' | 'seed'
}

export async function loadScexWithSource(): Promise<LoadScexResult> {
  const server = await fetchServerScex()
  if (server) {
    writeCache(server)
    return { dataset: server, source: 'server' }
  }
  const cache = readCache()
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
    const server = await fetchServerScex()
    baseUpdatedAt = server?.updatedAt
  } catch {
    /* ignore */
  }

  const payload = recomputeScexActors({
    ...dataset,
    note: note ?? dataset.note,
    updatedAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    baseUpdatedAt,
  } as ScexDataset & { baseUpdatedAt?: string })
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
    writeCache(payload)
    return {
      ok: true,
      dataset: payload,
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
  } catch {
    /* ignore */
  }
  emit()
}

export function exportScexJson(dataset: ScexDataset): string {
  return JSON.stringify(recomputeScexActors(dataset), null, 2)
}

export function importScexJson(text: string): ScexDataset {
  const n = normalizeScexDataset(JSON.parse(text))
  if (!n) throw new Error('Invalid SCEX JSON')
  return n
}
