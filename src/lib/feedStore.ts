import type { FeedPost, Tier1Feed } from '../types/feed'
import { withBase } from './base'

const STORAGE_KEY = 'vn-kol-map-feed-v1'
const TOKEN_KEY = 'vn-kol-feed-admin-token'
export const FEED_EVENT = 'vn-kol-feed-updated'

function seedUrl() {
  return withBase('/feed/tier1-feed.json')
}
function feedApiUrl() {
  return withBase('/api/feed')
}
function xStatusApiUrl(xUrl: string) {
  return `${withBase('/api/x-status')}?url=${encodeURIComponent(xUrl.trim())}`
}

export type FeedSource = 'server' | 'local' | 'seed'

export interface LoadFeedResult {
  feed: Tier1Feed
  source: FeedSource
}

/** Strip paste artifacts so client token matches Vercel FEED_ADMIN_TOKEN. */
export function normalizeAdminToken(token: string): string {
  return String(token || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
}

export function getAdminToken(): string {
  try {
    let t = sessionStorage.getItem(TOKEN_KEY) || ''
    if (!t) {
      const legacy = localStorage.getItem(TOKEN_KEY)
      if (legacy) {
        sessionStorage.setItem(TOKEN_KEY, legacy)
        localStorage.removeItem(TOKEN_KEY)
        t = legacy
      }
    }
    return normalizeAdminToken(t)
  } catch {
    return ''
  }
}

export function setAdminToken(token: string): void {
  try {
    const t = normalizeAdminToken(token)
    if (t) {
      sessionStorage.setItem(TOKEN_KEY, t)
      localStorage.removeItem(TOKEN_KEY)
    } else {
      sessionStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function loadFeedFromStorage(): Tier1Feed | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Tier1Feed
    if (!data?.posts || !Array.isArray(data.posts)) return null
    return normalizeFeed(data)
  } catch {
    return null
  }
}

export async function fetchSeedFeed(): Promise<Tier1Feed> {
  const res = await fetch(`${seedUrl()}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return normalizeFeed((await res.json()) as Tier1Feed)
}

/** GET /api/feed — returns null on 404/503/network. */
export async function fetchServerFeed(): Promise<Tier1Feed | null> {
  try {
    const res = await fetch(`${feedApiUrl()}?t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    const data = (await res.json()) as Tier1Feed
    if (!data?.posts || !Array.isArray(data.posts)) return null
    return normalizeFeed(data)
  } catch {
    return null
  }
}

/**
 * Load priority:
 * 1) Server KV (shared)
 * 2) localStorage cache/override
 * 3) public seed JSON
 */
export async function loadFeed(): Promise<Tier1Feed> {
  const result = await loadFeedWithSource()
  return result.feed
}

export async function loadFeedWithSource(): Promise<LoadFeedResult> {
  const server = await fetchServerFeed()
  if (server) {
    // Mirror server → local cache so offline / fast reopen works
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(server))
    } catch {
      /* ignore */
    }
    return { feed: server, source: 'server' }
  }

  const local = loadFeedFromStorage()
  if (local) return { feed: local, source: 'local' }

  const seed = await fetchSeedFeed()
  return { feed: seed, source: 'seed' }
}

/** Local-only save (cache / offline). */
export function saveFeedLocal(feed: Tier1Feed, note?: string): Tier1Feed {
  const next = normalizeFeed({
    ...feed,
    generatedAt: new Date().toISOString(),
    source: note
      ? `admin · ${note}`
      : feed.source?.startsWith('admin')
        ? feed.source
        : 'admin localStorage',
    mode: 'admin',
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  emitFeedEvent(next)
  return next
}

/** @deprecated use saveFeedLocal or saveFeedToServer */
export function saveFeed(feed: Tier1Feed, note?: string): Tier1Feed {
  return saveFeedLocal(feed, note)
}

export type ServerSaveResult =
  | { ok: true; feed: Tier1Feed }
  | { ok: false; error: string; status?: number }

/** PUT /api/feed + local mirror. */
export async function saveFeedToServer(
  feed: Tier1Feed,
  note?: string,
  tokenOverride?: string,
): Promise<ServerSaveResult> {
  const next = normalizeFeed({
    ...feed,
    generatedAt: new Date().toISOString(),
    source: note ? `admin server · ${note}` : 'admin server',
    mode: 'admin',
  })

  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có admin token — dán FEED_ADMIN_TOKEN vào ô Token.',
    }
  }

  let baseUpdatedAt: string | undefined
  try {
    const serverFeed = await fetchServerFeed()
    baseUpdatedAt = serverFeed?.generatedAt
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(feedApiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...next, baseUpdatedAt }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          body.message ||
          body.error ||
          `Server ${res.status}${
            res.status === 409
              ? ' — server có feed mới hơn, Reload rồi Save'
              : res.status === 401
              ? ' — token không khớp FEED_ADMIN_TOKEN trên Vercel'
              : res.status === 503
                ? ' — chưa cấu hình R2 / FEED_ADMIN_TOKEN (xem docs/FEED_SERVER.md)'
                : ''
          }`,
      }
    }
    // Local mirror
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    emitFeedEvent(next)
    return { ok: true, feed: next }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

/** Clear local only. Optional: clear server if token set. */
export function clearFeedStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  emitFeedEvent(null)
}

export async function clearFeedServer(): Promise<ServerSaveResult> {
  const token = getAdminToken()
  if (!token) {
    return { ok: false, error: 'Chưa có admin token' }
  }
  try {
    const res = await fetch(feedApiUrl(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      return {
        ok: false,
        status: res.status,
        error: body.message || `Server ${res.status}`,
      }
    }
    return { ok: true, feed: await fetchSeedFeed() }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

export function hasFeedOverride(): boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}

export function createEmptyPost(handle = 'handle'): FeedPost {
  const h = handle.replace(/^@/, '').trim() || 'handle'
  const id = `admin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    handle: h,
    displayName: h,
    text: '',
    createdAt: new Date().toISOString(),
    likes: 0,
    reposts: 0,
    replies: 0,
    views: 0,
    media: [],
    isReply: false,
    url: `https://x.com/${h}`,
    avatarLocal: `/avatars/${h}.jpg`,
  }
}

/** Posts older than this leave the live X Feed (default 14 days). */
export const FEED_ARCHIVE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export function normalizeFeed(feed: Tier1Feed): Tier1Feed {
  const posts = (feed.posts || []).map(normalizePost)
  const archivedPosts = (feed.archivedPosts || []).map(normalizePost)
  const handles = Array.from(
    new Set(posts.map((p) => p.handle).filter(Boolean)),
  )
  return {
    generatedAt: feed.generatedAt || new Date().toISOString(),
    source: feed.source || 'unknown',
    mode: feed.mode || 'demo',
    tier: feed.tier ?? 1,
    kolCount: handles.length,
    handles,
    postCount: posts.length,
    posts,
    archivedPosts,
    archivedCount: archivedPosts.length,
  }
}

/**
 * Move posts older than `maxAgeMs` (default 14 days) from posts → archivedPosts.
 * Keeps archive de-duplicated by id.
 */
export function archiveOldPosts(
  feed: Tier1Feed,
  maxAgeMs: number = FEED_ARCHIVE_MAX_AGE_MS,
  nowMs: number = Date.now(),
): { feed: Tier1Feed; moved: number } {
  const cutoff = nowMs - maxAgeMs
  const keep: FeedPost[] = []
  const toArchive: FeedPost[] = []
  for (const p of feed.posts || []) {
    const t = Date.parse(p.createdAt)
    if (!Number.isFinite(t) || t >= cutoff) keep.push(p)
    else toArchive.push(p)
  }
  if (toArchive.length === 0) {
    return { feed: normalizeFeed(feed), moved: 0 }
  }
  const byId = new Map<string, FeedPost>()
  for (const p of feed.archivedPosts || []) byId.set(p.id, p)
  for (const p of toArchive) byId.set(p.id, p)
  const archivedPosts = [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return {
    feed: normalizeFeed({
      ...feed,
      posts: keep,
      archivedPosts,
    }),
    moved: toArchive.length,
  }
}

/** Count posts that would be archived (older than maxAge). */
export function countArchivablePosts(
  feed: Tier1Feed,
  maxAgeMs: number = FEED_ARCHIVE_MAX_AGE_MS,
  nowMs: number = Date.now(),
): number {
  const cutoff = nowMs - maxAgeMs
  return (feed.posts || []).filter((p) => {
    const t = Date.parse(p.createdAt)
    return Number.isFinite(t) && t < cutoff
  }).length
}

export function normalizePost(p: Partial<FeedPost> & { id?: string }): FeedPost {
  const handle = (p.handle || 'handle').replace(/^@/, '').trim()
  return {
    id: p.id || `admin-${Date.now().toString(36)}`,
    handle,
    displayName: p.displayName || handle,
    text: p.text || '',
    createdAt: p.createdAt || new Date().toISOString(),
    likes: Number(p.likes) || 0,
    reposts: Number(p.reposts) || 0,
    replies: Number(p.replies) || 0,
    views: Number(p.views) || 0,
    media: Array.isArray(p.media)
      ? p.media.filter(Boolean)
      : typeof p.media === 'string' && String(p.media).trim()
        ? String(p.media)
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    isReply: !!p.isReply,
    url: p.url || `https://x.com/${handle}`,
    avatarLocal: p.avatarLocal || `/avatars/${handle}.jpg`,
  }
}

export function exportFeedJson(feed: Tier1Feed): string {
  return JSON.stringify(normalizeFeed(feed), null, 2)
}

export function importFeedJson(text: string): Tier1Feed {
  const data = JSON.parse(text) as Tier1Feed | FeedPost[]
  if (Array.isArray(data)) {
    return normalizeFeed({
      generatedAt: new Date().toISOString(),
      source: 'admin import posts[]',
      mode: 'admin',
      tier: 1,
      kolCount: 0,
      handles: [],
      postCount: data.length,
      posts: data,
    })
  }
  if (!data?.posts || !Array.isArray(data.posts)) {
    throw new Error('Invalid JSON: missing posts[]')
  }
  return normalizeFeed({ ...data, mode: 'admin', source: 'admin import' })
}

export function sortPostsLatest(posts: FeedPost[]): FeedPost[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type XStatusFetchResult =
  | {
      ok: true
      post: FeedPost & {
        mediaOriginal?: string[]
        mediaCached?: string[]
        fetchedAt?: string
        avatarRemote?: string
      }
      cache?: { redis: boolean; imagesCached: number; imagesTotal: number }
    }
  | { ok: false; error: string; status?: number }

/** Fetch X status snapshot via /api/x-status (server caches images to Redis). */
export async function fetchXStatusFromUrl(
  xUrl: string,
  tokenOverride?: string,
): Promise<XStatusFetchResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  try {
    const res = await fetch(xStatusApiUrl(xUrl), {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
      post?: FeedPost & {
        mediaOriginal?: string[]
        mediaCached?: string[]
        fetchedAt?: string
        avatarRemote?: string
      }
      cache?: { redis: boolean; imagesCached: number; imagesTotal: number }
    }
    if (!res.ok || !body.post) {
      return {
        ok: false,
        status: res.status,
        error:
          body.message ||
          body.error ||
          `Fetch failed (${res.status})`,
      }
    }
    return {
      ok: true,
      post: {
        ...normalizePost(body.post),
        mediaOriginal: body.post.mediaOriginal,
        mediaCached: body.post.mediaCached,
        fetchedAt: body.post.fetchedAt,
        avatarRemote: body.post.avatarRemote,
      },
      cache: body.cache,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

function emitFeedEvent(detail: Tier1Feed | null) {
  try {
    window.dispatchEvent(new CustomEvent(FEED_EVENT, { detail }))
  } catch {
    /* ignore */
  }
}
