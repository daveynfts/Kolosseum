/**
 * Smart / Recent Followers — R2 server first, then seed code.
 * localStorage is only a cache mirror after successful server load/save (no "save local" UX).
 */
import {
  RECENT_FOLLOWERS_BY_HANDLE,
  SMART_FOLLOWERS_BY_HANDLE,
  type RecentFollower,
  type SmartFollower,
} from '../data/recentFollowers'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const CACHE_KEY = 'vn-kol-map-recent-followers-v1'
export const RECENT_FOLLOWERS_EVENT = 'vn-kol-recent-followers-updated'

export type RecentFollowersMap = Record<string, RecentFollower[]>
export type SmartFollowersMap = Record<string, SmartFollower[]>

export type RecentFollowersPayload = {
  version?: number
  updatedAt?: string
  source?: string
  note?: string
  count?: number
  /** Recent followers (who followed the KOL recently) */
  map: RecentFollowersMap
  /** Smart / high-signal followers list */
  smartMap?: SmartFollowersMap
}

function apiUrl() {
  return withBase('/api/recent-followers')
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

function normalizeFollower(f: Partial<RecentFollower>): RecentFollower | null {
  const handle = normalizeHandle(f.handle || '')
  if (!handle) return null
  const score =
    typeof f.score === 'number' && Number.isFinite(f.score) ? f.score : undefined
  return {
    handle,
    displayName: (f.displayName || handle).trim(),
    followedAgo: (f.followedAgo || '').trim() || 'recently',
    followedAt: f.followedAt,
    score,
  }
}

function normalizeSmartFollower(
  f: Partial<SmartFollower>,
): SmartFollower | null {
  const handle = normalizeHandle(f.handle || '')
  if (!handle) return null
  return {
    handle,
    displayName: (f.displayName || handle).trim(),
    role: (f.role || '').trim() || undefined,
    followers:
      typeof f.followers === 'number' && Number.isFinite(f.followers)
        ? f.followers
        : undefined,
    influenceScore:
      typeof f.influenceScore === 'number' && Number.isFinite(f.influenceScore)
        ? f.influenceScore
        : undefined,
  }
}

export function normalizeMap(raw: unknown): RecentFollowersMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: RecentFollowersMap = {}
  for (const [k, list] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeHandle(k)
    if (!Array.isArray(list)) continue
    const followers = list
      .map((x) => normalizeFollower(x as Partial<RecentFollower>))
      .filter((x): x is RecentFollower => !!x)
    if (followers.length) out[key] = followers
  }
  return out
}

export function normalizeSmartMap(raw: unknown): SmartFollowersMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: SmartFollowersMap = {}
  for (const [k, list] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeHandle(k)
    if (!Array.isArray(list)) continue
    const followers = list
      .map((x) => normalizeSmartFollower(x as Partial<SmartFollower>))
      .filter((x): x is SmartFollower => !!x)
    if (followers.length) out[key] = followers
  }
  return out
}

/** Deep-clone of compiled seed. */
export function seedRecentFollowersMap(): RecentFollowersMap {
  return normalizeMap(RECENT_FOLLOWERS_BY_HANDLE)
}

export function seedSmartFollowersMap(): SmartFollowersMap {
  return normalizeSmartMap(SMART_FOLLOWERS_BY_HANDLE)
}

function writeCache(
  map: RecentFollowersMap,
  meta?: Partial<RecentFollowersPayload>,
) {
  try {
    const smartMap =
      meta?.smartMap !== undefined
        ? normalizeSmartMap(meta.smartMap)
        : readCache()?.smartMap
    const payload: RecentFollowersPayload = {
      version: 1,
      updatedAt: meta?.updatedAt || new Date().toISOString(),
      source: meta?.source,
      note: meta?.note,
      count: Object.keys(map).length,
      map,
      smartMap:
        smartMap && Object.keys(smartMap).length ? smartMap : undefined,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  emit()
}

function readCache(): RecentFollowersPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as RecentFollowersPayload | RecentFollowersMap
    // Legacy: plain map only
    if (data && typeof data === 'object' && !('map' in data)) {
      const map = normalizeMap(data)
      return Object.keys(map).length ? { map, version: 1 } : null
    }
    const payload = data as RecentFollowersPayload
    if (!payload?.map) return null
    const map = normalizeMap(payload.map)
    const smartMap = normalizeSmartMap(payload.smartMap)
    if (!Object.keys(map).length && !Object.keys(smartMap).length) return null
    return {
      ...payload,
      map,
      smartMap: Object.keys(smartMap).length ? smartMap : undefined,
    }
  } catch {
    return null
  }
}

/** Sync load: cache (mirror of server) → seed. Prefer loadRecentFollowersWithSource(). */
export function loadRecentFollowersMap(): RecentFollowersMap {
  return readCache()?.map ?? seedRecentFollowersMap()
}

export function hasRecentFollowersOverride(): boolean {
  // True when cache exists and differs from pure seed (admin has published or cached)
  try {
    return !!localStorage.getItem(CACHE_KEY)
  } catch {
    return false
  }
}

export async function fetchServerRecentFollowers(): Promise<RecentFollowersPayload | null> {
  try {
    const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    const data = (await res.json()) as RecentFollowersPayload
    if (!data?.map || typeof data.map !== 'object') return null
    const map = normalizeMap(data.map)
    const smartMap = normalizeSmartMap(data.smartMap)
    if (!Object.keys(map).length && !Object.keys(smartMap).length) return null
    return {
      ...data,
      map,
      smartMap: Object.keys(smartMap).length ? smartMap : undefined,
    }
  } catch {
    return null
  }
}

export type LoadFollowersResult = {
  map: RecentFollowersMap
  smartMap: SmartFollowersMap
  source: 'server' | 'cache' | 'seed'
  updatedAt: string | null
}

export async function loadRecentFollowersWithSource(): Promise<LoadFollowersResult> {
  const server = await fetchServerRecentFollowers()
  if (server) {
    writeCache(server.map, server)
    return {
      map: server.map,
      smartMap: server.smartMap ?? {},
      source: 'server',
      updatedAt: server.updatedAt ?? null,
    }
  }
  const cache = readCache()
  if (cache) {
    return {
      map: cache.map,
      smartMap: cache.smartMap ?? {},
      source: 'cache',
      updatedAt: cache.updatedAt ?? null,
    }
  }
  return {
    map: seedRecentFollowersMap(),
    smartMap: seedSmartFollowersMap(),
    source: 'seed',
    updatedAt: null,
  }
}

export type ServerFollowersSaveResult =
  | { ok: true; count: number; updatedAt: string; map: RecentFollowersMap }
  | { ok: false; error: string; status?: number }

/** Publish full map to R2. No standalone local-only save. */
export async function saveRecentFollowersToServer(
  map: RecentFollowersMap,
  note?: string,
  tokenOverride?: string,
  smartMap?: SmartFollowersMap,
): Promise<ServerFollowersSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN rồi Apply token.',
    }
  }
  const next = normalizeMap(map)
  const nextSmart =
    smartMap !== undefined
      ? normalizeSmartMap(smartMap)
      : readCache()?.smartMap || seedSmartFollowersMap()
  const payload: RecentFollowersPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: note ? `admin server · ${note}` : 'admin server',
    note,
    count: Object.keys(next).length,
    map: next,
    smartMap: Object.keys(nextSmart).length ? nextSmart : undefined,
  }
  try {
    const res = await fetch(apiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
      updatedAt?: string
      count?: number
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: body.message || body.error || `Server ${res.status}`,
      }
    }
    writeCache(next, {
      updatedAt: body.updatedAt || payload.updatedAt,
      source: payload.source,
      smartMap: payload.smartMap,
    })
    return {
      ok: true,
      count: body.count ?? payload.count!,
      updatedAt: body.updatedAt || payload.updatedAt!,
      map: next,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

/** @deprecated name — use saveRecentFollowersToServer. Kept for import merge only. */
export function saveRecentFollowersMap(map: RecentFollowersMap): RecentFollowersMap {
  const next = normalizeMap(map)
  writeCache(next, { source: 'admin cache (prefer server Save)' })
  return next
}

export function clearRecentFollowersOverride(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

export function getRecentFollowersFor(
  handle: string,
  map?: RecentFollowersMap,
): RecentFollower[] {
  const m = map ?? loadRecentFollowersMap()
  return m[normalizeHandle(handle)] ?? []
}

export function setRecentFollowersFor(
  map: RecentFollowersMap,
  kolHandle: string,
  followers: RecentFollower[],
): RecentFollowersMap {
  const key = normalizeHandle(kolHandle)
  const next = { ...map }
  const list = followers
    .map((f) => normalizeFollower(f))
    .filter((f): f is RecentFollower => !!f)
  if (list.length === 0) delete next[key]
  else next[key] = list
  return next
}

export function listKolHandlesWithFollowers(map?: RecentFollowersMap): string[] {
  const m = map ?? loadRecentFollowersMap()
  return Object.keys(m).sort((a, b) => a.localeCompare(b))
}

export function exportRecentFollowersJson(map?: RecentFollowersMap): string {
  return JSON.stringify(map ?? loadRecentFollowersMap(), null, 2)
}

export function importRecentFollowersJson(text: string): RecentFollowersMap {
  const parsed = JSON.parse(text) as
    | RecentFollowersMap
    | { map?: RecentFollowersMap }
  if (parsed && typeof parsed === 'object' && 'map' in parsed && parsed.map) {
    return normalizeMap(parsed.map)
  }
  return normalizeMap(parsed)
}

function emit() {
  try {
    window.dispatchEvent(new CustomEvent(RECENT_FOLLOWERS_EVENT))
  } catch {
    /* ignore */
  }
}
