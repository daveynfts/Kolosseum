import type { FeedPost, Tier1Feed } from '../types/feed'

const STORAGE_KEY = 'vn-kol-map-feed-v1'
const TOKEN_KEY = 'vn-kol-feed-admin-token'
const SEED_URL = '/feed/tier1-feed.json'
const API_URL = '/api/feed'
export const FEED_EVENT = 'vn-kol-feed-updated'

export type FeedSource = 'server' | 'local' | 'seed'

export interface LoadFeedResult {
  feed: Tier1Feed
  source: FeedSource
}

export function getAdminToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim())
    else localStorage.removeItem(TOKEN_KEY)
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
  const res = await fetch(`${SEED_URL}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return normalizeFeed((await res.json()) as Tier1Feed)
}

/** GET /api/feed — returns null on 404/503/network. */
export async function fetchServerFeed(): Promise<Tier1Feed | null> {
  try {
    const res = await fetch(`${API_URL}?t=${Date.now()}`, {
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

  try {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(next),
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
            res.status === 401
              ? ' — token không khớp FEED_ADMIN_TOKEN trên Vercel'
              : res.status === 503
                ? ' — chưa cấu hình Redis / FEED_ADMIN_TOKEN'
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
    const res = await fetch(API_URL, {
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

export function normalizeFeed(feed: Tier1Feed): Tier1Feed {
  const posts = (feed.posts || []).map(normalizePost)
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
  }
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

function emitFeedEvent(detail: Tier1Feed | null) {
  try {
    window.dispatchEvent(new CustomEvent(FEED_EVENT, { detail }))
  } catch {
    /* ignore */
  }
}
