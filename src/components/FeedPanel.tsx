import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Tier1Feed, FeedPost } from '../types/feed'
import { AvatarImg } from './AvatarImg'
import { NICHE_COLORS } from '../types'
import type { Kol } from '../types'
import { FEED_EVENT, loadFeed } from '../lib/feedStore'
import { withBase } from '../lib/base'

type SortMode = 'latest' | 'hot'

interface Props {
  open: boolean
  onClose: () => void
  kols: Kol[]
  onSelectKol: (kol: Kol | null) => void
}

export function FeedPanel({ open, onClose, kols, onSelectKol }: Props) {
  const [feed, setFeed] = useState<Tier1Feed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterHandle, setFilterHandle] = useState<string>('All')
  const [sort, setSort] = useState<SortMode>('latest')
  const [query, setQuery] = useState('')
  const [compact, setCompact] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const listRef = useRef<HTMLDivElement>(null)

  const kolByHandle = useMemo(() => {
    const m = new Map<string, Kol>()
    kols.forEach((k) => m.set(k.handle.toLowerCase(), k))
    return m
  }, [kols])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      // Prefer Admin localStorage override; else seed /feed/tier1-feed.json
      const data = await loadFeed()
      setFeed(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    const refresh = () => void load(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vn-kol-map-feed-v1' || e.key === null) refresh()
    }
    window.addEventListener(FEED_EVENT, refresh)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(FEED_EVENT, refresh)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(id)
  }, [open, load])

  useEffect(() => {
    if (!feed?.posts[0]) return
    setHighlightId(feed.posts[0].id)
    const t = window.setTimeout(() => setHighlightId(null), 1800)
    return () => window.clearTimeout(t)
  }, [feed?.generatedAt])

  const voiceStats = useMemo(() => {
    if (!feed) return [] as Array<{ handle: string; name: string; count: number; color: string }>
    const map = new Map<string, number>()
    feed.posts.forEach((p) => {
      map.set(p.handle, (map.get(p.handle) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([handle, count]) => {
        const kol = kolByHandle.get(handle.toLowerCase())
        const sample = feed.posts.find((p) => p.handle === handle)
        return {
          handle,
          name: sample?.displayName ?? handle,
          count,
          color: kol ? NICHE_COLORS[kol.niche] : '#94a3b8',
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [feed, kolByHandle])

  const posts = useMemo(() => {
    if (!feed) return []
    let list = [...feed.posts]
    if (filterHandle !== 'All') {
      list = list.filter(
        (p) => p.handle.toLowerCase() === filterHandle.toLowerCase(),
      )
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.text.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q),
      )
    }
    if (sort === 'hot') {
      list.sort(
        (a, b) =>
          engagementScore(b) - engagementScore(a) ||
          b.createdAt.localeCompare(a.createdAt),
      )
    } else {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return list
  }, [feed, filterHandle, query, sort])

  const totals = useMemo(() => {
    if (!feed) return { likes: 0, views: 0, voices: 0 }
    return {
      likes: feed.posts.reduce((s, p) => s + p.likes, 0),
      views: feed.posts.reduce((s, p) => s + p.views, 0),
      voices: new Set(feed.posts.map((p) => p.handle)).size,
    }
  }, [feed])

  const setFilter = (h: string) => {
    setFilterHandle(h)
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!open) return null

  return (
    <aside className={`feed-panel glass ${compact ? 'feed-panel--compact' : ''}`}>
      {/* Header */}
      <header className="feed-head">
        <div className="feed-head-main">
          <div className="feed-title-row">
            <span className="live-dot" aria-hidden />
            <h2>Tier 1 Feed</h2>
            <span className="feed-badge">
              {feed?.mode === 'admin' || (feed?.source || '').startsWith('admin')
                ? 'ADMIN'
                : 'DEMO'}
            </span>
          </div>
          <p className="feed-sub">
            {feed?.mode === 'admin' || (feed?.source || '').startsWith('admin')
              ? 'Admin curated'
              : 'Tổng hợp X'}{' '}
            · {feed?.kolCount ?? '—'} KOL · cập nhật{' '}
            {feed?.generatedAt ? formatTime(feed.generatedAt) : '…'}
          </p>
        </div>
        <div className="feed-actions">
          <button
            type="button"
            className="icon-btn"
            title={compact ? 'Mở rộng' : 'Thu gọn'}
            onClick={() => setCompact((v) => !v)}
          >
            {compact ? '▣' : '▬'}
          </button>
          <button
            type="button"
            className={`icon-btn ${loading ? 'icon-btn--spin' : ''}`}
            title="Làm mới"
            onClick={() => void load()}
            disabled={loading}
          >
            ↻
          </button>
          <button type="button" className="icon-btn" title="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      {!compact && (
        <>
          {/* Stats strip */}
          <div className="feed-stats-bar">
            <div className="feed-stat">
              <em>{feed?.postCount ?? '—'}</em>
              <span>posts</span>
            </div>
            <div className="feed-stat">
              <em>{totals.voices || '—'}</em>
              <span>voices</span>
            </div>
            <div className="feed-stat">
              <em>{fmt(totals.likes)}</em>
              <span>likes</span>
            </div>
            <div className="feed-stat">
              <em>{fmt(totals.views)}</em>
              <span>views</span>
            </div>
          </div>

          {/* Search + sort */}
          <div className="feed-toolbar">
            <label className="feed-search">
              <span className="feed-search-icon">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm post, @handle…"
                aria-label="Search feed"
              />
              {query && (
                <button
                  type="button"
                  className="feed-search-clear"
                  onClick={() => setQuery('')}
                >
                  ×
                </button>
              )}
            </label>
            <div className="feed-sort" role="group" aria-label="Sort">
              <button
                type="button"
                className={sort === 'latest' ? 'is-active' : ''}
                onClick={() => setSort('latest')}
              >
                Mới
              </button>
              <button
                type="button"
                className={sort === 'hot' ? 'is-active' : ''}
                onClick={() => setSort('hot')}
              >
                Hot
              </button>
            </div>
          </div>

          {/* Voice chips with avatars */}
          <div className="feed-filters" role="tablist" aria-label="Filter by KOL">
            <button
              type="button"
              role="tab"
              aria-selected={filterHandle === 'All'}
              className={`voice-chip ${filterHandle === 'All' ? 'is-active' : ''}`}
              onClick={() => setFilter('All')}
            >
              <span className="voice-chip__all">All</span>
              <span className="voice-chip__count">{feed?.postCount ?? 0}</span>
            </button>
            {voiceStats.map((v) => (
              <button
                key={v.handle}
                type="button"
                role="tab"
                aria-selected={filterHandle === v.handle}
                className={`voice-chip ${filterHandle === v.handle ? 'is-active' : ''}`}
                style={{ ['--voice' as string]: v.color }}
                onClick={() => setFilter(v.handle)}
                title={`@${v.handle}`}
              >
                <AvatarImg
                  handle={v.handle}
                  name={v.name}
                  size={22}
                  color={v.color}
                  className="voice-chip__av"
                />
                <span className="voice-chip__name">
                  {shortName(v.name, v.handle)}
                </span>
                <span className="voice-chip__count">{v.count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="feed-error">
          <p>Không tải được feed</p>
          <span>{error}</span>
          <button type="button" className="btn" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {/* List */}
      <div className="feed-list" ref={listRef}>
        {loading && !feed && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {posts.map((p, i) => {
          const kol = kolByHandle.get(p.handle.toLowerCase())
          const color = kol ? NICHE_COLORS[kol.niche] : '#94a3b8'
          return (
            <FeedCard
              key={p.id}
              post={p}
              index={i}
              color={color}
              niche={kol?.niche}
              highlight={p.id === highlightId}
              expanded={!!expanded[p.id]}
              onToggleExpand={() =>
                setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
              }
              onFocusKol={() => {
                if (kol) onSelectKol(kol)
              }}
            />
          )
        })}

        {!loading && feed && posts.length === 0 && (
          <div className="feed-empty">
            <div className="feed-empty__icon">∅</div>
            <p>Không có bài khớp</p>
            <span>
              {query
                ? `Thử từ khóa khác hoặc xóa filter`
                : `Voice này chưa có post trong snapshot`}
            </span>
            {(query || filterHandle !== 'All') && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setQuery('')
                  setFilter('All')
                }}
              >
                Reset bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <footer className="feed-foot">
          <span className="feed-foot__left">
            Hiển thị <strong>{posts.length}</strong>
            {feed ? ` / ${feed.postCount}` : ''}
          </span>
          <span className="feed-foot__right">Snapshot demo · auto 45s</span>
        </footer>
      )}
    </aside>
  )
}

function FeedCard({
  post,
  color,
  niche,
  highlight,
  expanded,
  index,
  onToggleExpand,
  onFocusKol,
}: {
  post: FeedPost
  color: string
  niche?: string
  highlight: boolean
  expanded: boolean
  index: number
  onToggleExpand: () => void
  onFocusKol: () => void
}) {
  const long = post.text.length > 220 || post.text.split('\n').length > 5
  const hot = engagementScore(post) >= 80
  const displayText =
    !expanded && long ? post.text.slice(0, 210).trimEnd() + '…' : post.text

  return (
    <article
      className={[
        'feed-card',
        highlight ? 'feed-card--flash' : '',
        hot ? 'feed-card--hot' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
    >
      <div
        className="feed-card__accent"
        style={{ background: color }}
        aria-hidden
      />

      <div className="feed-card-top">
        <button type="button" className="feed-author" onClick={onFocusKol}>
          <div className="feed-av-wrap" style={{ boxShadow: `0 0 0 2px ${color}55` }}>
            <AvatarImg
              handle={post.handle}
              name={post.displayName}
              size={42}
              color={color}
            />
          </div>
          <div className="feed-author-meta">
            <div className="feed-author-name">
              <strong>{post.displayName}</strong>
              {hot && <span className="hot-pill">HOT</span>}
              {niche && (
                <span className="niche-pill" style={{ color, borderColor: `${color}55` }}>
                  {niche}
                </span>
              )}
            </div>
            <span className="feed-author-sub">
              @{post.handle}
              <span className="feed-dot">·</span>
              <time dateTime={post.createdAt}>{relTime(post.createdAt)}</time>
            </span>
          </div>
        </button>
        <div className="feed-card-actions">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="Focus trên map"
            onClick={onFocusKol}
          >
            ◎
          </button>
          <a
            className="icon-btn icon-btn--sm"
            href={post.url}
            target="_blank"
            rel="noreferrer"
            title="Mở trên X"
          >
            ↗
          </a>
        </div>
      </div>

      <p className={`feed-text ${expanded ? 'is-expanded' : ''}`}>{displayText}</p>
      {long && (
        <button type="button" className="feed-more" onClick={onToggleExpand}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}

      {post.media[0] && (
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="feed-media"
        >
          <img
            src={withBase(post.media[0])}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </a>
      )}

      <div className="feed-metrics">
        <span title="Likes">
          <i>♥</i> {fmt(post.likes)}
        </span>
        <span title="Reposts">
          <i>↻</i> {fmt(post.reposts)}
        </span>
        <span title="Replies">
          <i>💬</i> {fmt(post.replies)}
        </span>
        <span title="Views">
          <i>👁</i> {fmt(post.views)}
        </span>
      </div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="feed-card feed-card--skeleton" aria-hidden>
      <div className="sk-row">
        <div className="sk sk-av" />
        <div className="sk-col">
          <div className="sk sk-line sk-line--sm" />
          <div className="sk sk-line sk-line--xs" />
        </div>
      </div>
      <div className="sk sk-line" />
      <div className="sk sk-line" />
      <div className="sk sk-line sk-line--md" />
    </div>
  )
}

function engagementScore(p: FeedPost) {
  return p.likes + p.reposts * 3 + p.replies * 2 + Math.min(p.views / 200, 40)
}

function fmt(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return iso
  }
}

function relTime(iso: string) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} giờ`
  const d = Math.floor(h / 24)
  return `${d} ngày`
}

function shortName(name: string, handle: string) {
  const n = name.split('|')[0].trim()
  if (n.length <= 14) return n
  return handle.length <= 12 ? handle : handle.slice(0, 11) + '…'
}
