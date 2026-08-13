import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Tier1Feed, FeedPost } from '../types/feed'
import { AvatarImg } from './AvatarImg'
import { NICHE_COLORS } from '../types'
import type { Kol } from '../types'
import { FEED_EVENT, loadFeed } from '../lib/feedStore'
import { resolveMediaUrl } from '../lib/avatar'
import { isSafeImageUrl, safeHref } from '../lib/safeUrl'
import { RankBadge } from './RankBadge'
import { StatusBadge } from './StatusBadge'

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
  const loadSeqRef = useRef(0)

  const kolByHandle = useMemo(() => {
    const m = new Map<string, Kol>()
    kols.forEach((k) => m.set(k.handle.toLowerCase(), k))
    return m
  }, [kols])

  const load = useCallback(async (silent = false) => {
    const seq = ++loadSeqRef.current
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await loadFeed()
      if (seq !== loadSeqRef.current) return
      setFeed(data)
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      loadSeqRef.current += 1
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

  const newestPostId = useMemo(() => {
    if (!feed?.posts.length) return null
    let latest = feed.posts[0]
    for (const p of feed.posts) {
      if (p.createdAt.localeCompare(latest.createdAt) > 0) latest = p
    }
    return latest.id
  }, [feed?.generatedAt, feed?.posts])

  useEffect(() => {
    if (!newestPostId) return
    setHighlightId(newestPostId)
    const t = window.setTimeout(() => setHighlightId(null), 1800)
    return () => window.clearTimeout(t)
  }, [newestPostId])

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
    <aside className={`feed-panel glass-regular glass--liquid ${compact ? 'feed-panel--compact' : ''}`}>
      {/* Header */}
      <header className="feed-head">
        <div className="feed-head-main">
          <div className="feed-title-row">
            <span className="live-dot" aria-hidden />
            <h2>X Feed</h2>
            <span className="feed-badge feed-badge--live">LIVE</span>
          </div>
          <p className="feed-sub">
            {feed
              ? `${feed.postCount} bài · ${totals.voices} KOL · ${relTime(feed.generatedAt)}`
              : 'Đang tải timeline…'}
          </p>
        </div>
        <div className="feed-actions">
          <button
            type="button"
            className="icon-btn"
            title={compact ? 'Mở rộng' : 'Thu gọn'}
            onClick={() => setCompact((v) => !v)}
          >
            {compact ? (
              <ChevronDownIcon />
            ) : (
              <ChevronUpIcon />
            )}
          </button>
          <button
            type="button"
            className={`icon-btn ${loading ? 'icon-btn--spin' : ''}`}
            title="Làm mới"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshIcon />
          </button>
          <button type="button" className="icon-btn" title="Đóng" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>

      {!compact && (
        <>
          <div className="feed-toolbar">
            <label className="feed-search">
              <span className="feed-search-icon" aria-hidden>
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm bài, @handle…"
                aria-label="Search feed"
              />
              {query && (
                <button
                  type="button"
                  className="feed-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Xóa tìm kiếm"
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
                  size={20}
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
              kol={kol}
              index={i}
              color={color}
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
          <span className="feed-foot__right">Tự làm mới 60s</span>
        </footer>
      )}
    </aside>
  )
}

function FeedCard({
  post,
  kol,
  color,
  highlight,
  expanded,
  index,
  onToggleExpand,
  onFocusKol,
}: {
  post: FeedPost
  kol?: Kol
  color: string
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
  const postHref = safeHref(post.url)
  const mediaSrc = post.media[0] ? resolveMediaUrl(post.media[0]) : ''
  const mediaOk = isSafeImageUrl(mediaSrc)
  const [mediaBroken, setMediaBroken] = useState(false)

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
      <div className="feed-card-top">
        <button type="button" className="feed-author" onClick={onFocusKol}>
          <div
            className="feed-av-wrap"
            style={{ ['--voice' as string]: color }}
          >
            <AvatarImg
              handle={post.handle}
              name={post.displayName}
              size={40}
              color={color}
            />
            {kol && (
              <span className="feed-av-rank">
                <RankBadge
                  rank={kol.rank}
                  tier={kol.tier}
                  score={kol.score}
                  isTop30={kol.isTop30}
                  size="pip"
                />
              </span>
            )}
          </div>
          <div className="feed-author-meta">
            <div className="feed-author-name">
              <strong>{post.displayName}</strong>
              {hot && <StatusBadge status="hot" size="pip" />}
            </div>
            <span className="feed-author-sub">
              @{post.handle}
              <span className="feed-dot">·</span>
              <time dateTime={post.createdAt} title={formatTime(post.createdAt)}>
                {relTime(post.createdAt)}
              </time>
            </span>
          </div>
        </button>
        {postHref ? (
          <a
            className="feed-open-x"
            href={postHref}
            target="_blank"
            rel="noreferrer"
            title="Mở trên X"
          >
            <XLogoIcon />
          </a>
        ) : null}
      </div>

      <p className={`feed-text ${expanded ? 'is-expanded' : ''}`}>
        {linkify(displayText)}
      </p>
      {long && (
        <button type="button" className="feed-more" onClick={onToggleExpand}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}

      {mediaOk && !mediaBroken &&
        (postHref ? (
          <a
            href={postHref}
            target="_blank"
            rel="noreferrer"
            className="feed-media"
          >
            <img
              src={mediaSrc}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setMediaBroken(true)}
            />
          </a>
        ) : (
          <div className="feed-media">
            <img
              src={mediaSrc}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setMediaBroken(true)}
            />
          </div>
        ))}

      <div className="feed-metrics">
        <span title="Likes">
          <HeartIcon /> {fmt(post.likes)}
        </span>
        <span title="Reposts">
          <RepostIcon /> {fmt(post.reposts)}
        </span>
        <span title="Replies">
          <ReplyIcon /> {fmt(post.replies)}
        </span>
        <span title="Views">
          <ViewIcon /> {fmt(post.views)}
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

function linkify(text: string) {
  const parts = text.split(/((?:https?:\/\/[^\s]+)|(?:@[A-Za-z0-9_]{1,20}))/g)
  return parts.map((part, i) => {
    if (part.startsWith('http')) {
      const trimmed = part.replace(/[),.;!?]+$/g, '')
      const href = safeHref(trimmed)
      if (!href) return part
      const label = trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '')
      return (
        <a
          key={i}
          className="feed-link"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {label.length > 36 ? `${label.slice(0, 34)}…` : label}
        </a>
      )
    }
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={i} className="feed-mention">
          {part}
        </span>
      )
    }
    return part
  })
}

function iconProps() {
  return {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true as const,
  }
}

function SearchIcon() {
  return (
    <svg {...iconProps()} width={13} height={13}>
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20.5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M20 12a8 8 0 1 1-2.2-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 4.5V9h-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XLogoIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M12 20s-7-4.4-9.2-8.2C1 9.2 2.4 6 5.6 6c1.9 0 3.2 1.1 4 2.2C10.4 7.1 11.7 6 13.6 6c3.2 0 4.6 3.2 2.8 5.8C16.2 15.6 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RepostIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M7 7h9.5a3.5 3.5 0 0 1 0 7H15M17 17H7.5a3.5 3.5 0 0 1 0-7H9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9 4.5 7 7l2 2.5M15 19.5 17 17l-2-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M5 12c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.7 0-1.4-.1-2-.3L5 19.5 6.2 16A6.4 6.4 0 0 1 5 12z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ViewIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
