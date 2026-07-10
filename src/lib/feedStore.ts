import type { FeedPost, Tier1Feed } from '../types/feed'

const STORAGE_KEY = 'vn-kol-map-feed-v1'
const SEED_URL = '/feed/tier1-feed.json'
export const FEED_EVENT = 'vn-kol-feed-updated'

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

/** Prefer admin localStorage override; else seed JSON. */
export async function loadFeed(): Promise<Tier1Feed> {
  const local = loadFeedFromStorage()
  if (local) return local
  return fetchSeedFeed()
}

export function saveFeed(feed: Tier1Feed, note?: string): Tier1Feed {
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
  try {
    window.dispatchEvent(new CustomEvent(FEED_EVENT, { detail: next }))
  } catch {
    /* ignore */
  }
  return next
}

export function clearFeedStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  try {
    window.dispatchEvent(new CustomEvent(FEED_EVENT, { detail: null }))
  } catch {
    /* ignore */
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
      : typeof p.media === 'string' && (p.media as string).trim()
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
