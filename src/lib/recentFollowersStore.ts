/**
 * Recent / Smart Followers — seed data + localStorage admin override.
 */
import {
  RECENT_FOLLOWERS_BY_HANDLE,
  type RecentFollower,
} from '../data/recentFollowers'

const STORAGE_KEY = 'vn-kol-map-recent-followers-v1'
export const RECENT_FOLLOWERS_EVENT = 'vn-kol-recent-followers-updated'

export type RecentFollowersMap = Record<string, RecentFollower[]>

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

function normalizeFollower(f: Partial<RecentFollower>): RecentFollower | null {
  const handle = normalizeHandle(f.handle || '')
  if (!handle) return null
  return {
    handle,
    displayName: (f.displayName || handle).trim(),
    followedAgo: (f.followedAgo || '').trim() || 'recently',
    followedAt: f.followedAt,
  }
}

function normalizeMap(raw: unknown): RecentFollowersMap {
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

/** Deep-clone of compiled seed. */
export function seedRecentFollowersMap(): RecentFollowersMap {
  return normalizeMap(RECENT_FOLLOWERS_BY_HANDLE)
}

export function loadRecentFollowersOverride(): RecentFollowersMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const map = normalizeMap(JSON.parse(raw))
    return Object.keys(map).length ? map : null
  } catch {
    return null
  }
}

/** Effective map: local override if present, else seed. */
export function loadRecentFollowersMap(): RecentFollowersMap {
  return loadRecentFollowersOverride() ?? seedRecentFollowersMap()
}

export function hasRecentFollowersOverride(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

export function saveRecentFollowersMap(map: RecentFollowersMap): RecentFollowersMap {
  const next = normalizeMap(map)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  emit()
  return next
}

export function clearRecentFollowersOverride(): void {
  localStorage.removeItem(STORAGE_KEY)
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
  return normalizeMap(JSON.parse(text))
}

function emit() {
  try {
    window.dispatchEvent(new CustomEvent(RECENT_FOLLOWERS_EVENT))
  } catch {
    /* ignore */
  }
}
