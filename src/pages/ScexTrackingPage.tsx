/**
 * Public partner view — SCEX 2D/3D mention matrix + livefeed (VI).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  actorPassesThresholds,
  actorVolumeMetric,
  isMixedSentiment,
  type ScexActor,
  type ScexDataset,
  type ScexPost,
} from '../data/scexTracking'
import { loadScexWithSource } from '../lib/scexStore'
import { loadKolsWithSource } from '../lib/kolStore'
import type { Kol } from '../types'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { ScexMatrix2D } from '../components/ScexMatrix2D'
import { ScexMatrix3D } from '../components/ScexMatrix3D'
import { ScexKolDetail } from '../components/ScexKolDetail'
import { resolveMediaUrl } from '../lib/avatar'
import './ScexTrackingPage.css'

type MatrixView = '2d' | '3d'

const VIEW_KEY = 'scex-matrix-view-v1'
const FILTER_KEY = 'scex-matrix-filters-v1'

function readView(): MatrixView {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === '2d' || v === '3d') return v
  } catch {
    /* ignore */
  }
  return '2d'
}

/** Matrix filter pill ids — multi-select with AND logic */
type MatrixFilterId =
  | 'on_map'
  | 'f_10k'
  | 'f_50k'
  | 'f_100k'
  | 'sent_bullish'
  | 'sent_bearish'
  | 'sent_neutral'
  | 'vol_high'
  | 'qual_high'
  | 'quad_stars'
  | 'quad_nurture'
  | 'quad_noise'
  | 'quad_ignore'

const FOLLOWER_FILTERS: MatrixFilterId[] = ['f_10k', 'f_50k', 'f_100k']
const SENT_FILTERS: MatrixFilterId[] = [
  'sent_bullish',
  'sent_bearish',
  'sent_neutral',
]
const QUAD_FILTERS: MatrixFilterId[] = [
  'quad_stars',
  'quad_nurture',
  'quad_noise',
  'quad_ignore',
]

const MATRIX_FILTER_PILLS: Array<{
  id: MatrixFilterId
  label: string
  title: string
  group?: 'followers' | 'sentiment' | 'quad'
}> = [
  { id: 'on_map', label: 'Trên map', title: 'KOL đã verify trên Radar map' },
  {
    id: 'f_10k',
    label: '≥10K FL',
    title: 'Followers ≥ 10.000',
    group: 'followers',
  },
  {
    id: 'f_50k',
    label: '≥50K FL',
    title: 'Followers ≥ 50.000',
    group: 'followers',
  },
  {
    id: 'f_100k',
    label: '≥100K FL',
    title: 'Followers ≥ 100.000',
    group: 'followers',
  },
  {
    id: 'sent_bullish',
    label: 'Tích cực',
    title: 'Sentiment bullish',
    group: 'sentiment',
  },
  {
    id: 'sent_bearish',
    label: 'Tiêu cực',
    title: 'Sentiment bearish',
    group: 'sentiment',
  },
  {
    id: 'sent_neutral',
    label: 'Trung lập',
    title: 'Neutral / hỗn hợp',
    group: 'sentiment',
  },
  {
    id: 'vol_high',
    label: 'Tần suất cao',
    title: 'Volume score ≥ split (trục X)',
  },
  {
    id: 'qual_high',
    label: 'Chất lượng cao',
    title: 'Quality score ≥ split (trục Y)',
  },
  {
    id: 'quad_stars',
    label: 'Trọng điểm',
    title: 'Vùng TRỌNG ĐIỂM',
    group: 'quad',
  },
  {
    id: 'quad_nurture',
    label: 'Tiềm năng',
    title: 'Vùng TIỀM NĂNG',
    group: 'quad',
  },
  {
    id: 'quad_noise',
    label: 'Rà soát',
    title: 'Vùng CẦN RÀ SOÁT',
    group: 'quad',
  },
  {
    id: 'quad_ignore',
    label: 'Tín hiệu yếu',
    title: 'Vùng TÍN HIỆU YẾU',
    group: 'quad',
  },
]

function readFilters(): Set<MatrixFilterId> {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.filter((x): x is MatrixFilterId =>
        MATRIX_FILTER_PILLS.some((p) => p.id === x),
      ),
    )
  } catch {
    return new Set()
  }
}

function actorMatchesFilters(
  a: ScexActor,
  filters: Set<MatrixFilterId>,
  mapHandles: Set<string>,
  volumeSplit: number,
  qualitySplit: number,
  config: ScexDataset['config'],
): boolean {
  if (!filters.size) return true
  const h = a.handle.toLowerCase()
  const vol = actorVolumeMetric(a, config)
  const onMap = mapHandles.has(h)

  for (const f of filters) {
    switch (f) {
      case 'on_map':
        if (!onMap) return false
        break
      case 'f_10k':
        if (a.followers < 10_000) return false
        break
      case 'f_50k':
        if (a.followers < 50_000) return false
        break
      case 'f_100k':
        if (a.followers < 100_000) return false
        break
      case 'sent_bullish':
        if (a.sentiment !== 'bullish') return false
        break
      case 'sent_bearish':
        if (a.sentiment !== 'bearish') return false
        break
      case 'sent_neutral':
        if (a.sentiment !== 'neutral' && !isMixedSentiment(a)) return false
        break
      case 'vol_high':
        if (vol < volumeSplit) return false
        break
      case 'qual_high':
        if (a.qualityScore < qualitySplit) return false
        break
      case 'quad_stars':
        if (a.quadrant !== 'stars') return false
        break
      case 'quad_nurture':
        if (a.quadrant !== 'nurture') return false
        break
      case 'quad_noise':
        if (a.quadrant !== 'noise') return false
        break
      case 'quad_ignore':
        if (a.quadrant !== 'ignore') return false
        break
      default:
        break
    }
  }
  return true
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
    return d.toLocaleString('vi-VN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

/** Prefer Vietnamese labels even if seed still has English. */
function viMatrixTitle(raw: string): string {
  if (!raw || /mention matrix|matrix/i.test(raw)) return 'Ma trận mention SCEX'
  return raw
}
function viFeedTitle(raw: string): string {
  if (!raw || /livefeed/i.test(raw)) return 'Bảng tin X · mention SCEX'
  return raw
}

export function ScexTrackingPage() {
  const [dataset, setDataset] = useState<ScexDataset | null>(null)
  const [mapKols, setMapKols] = useState<Kol[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedActor, setSelectedActor] = useState<ScexActor | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [matrixView, setMatrixView] = useState<MatrixView>(() => readView())
  /** Livefeed filter: null = all, or lowercase handle */
  const [feedFilter, setFeedFilter] = useState<string | null>(null)
  const [feedQuery, setFeedQuery] = useState('')
  const [matrixFilters, setMatrixFilters] = useState<Set<MatrixFilterId>>(
    () => readFilters(),
  )

  useEffect(() => {
    let cancelled = false
    void loadScexWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
    })
    void loadKolsWithSource().then((r) => {
      if (cancelled) return
      setMapKols(r.kols || [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Keep detail panel below event banner (avoid overlap)
  useEffect(() => {
    const el = document.querySelector('.scex-event-banner')
    const apply = () => {
      const h = el?.getBoundingClientRect().height ?? 0
      document.documentElement.style.setProperty(
        '--scex-banner-h',
        `${Math.max(0, Math.round(h))}px`,
      )
    }
    apply()
    const ro =
      el && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(apply)
        : null
    if (el && ro) ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [])

  const setView = (v: MatrixView) => {
    setMatrixView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
    if (v === '2d') setAutoRotate(false)
  }

  const toggleMatrixFilter = (id: MatrixFilterId) => {
    setMatrixFilters((prev) => {
      const next = new Set(prev)
      const pill = MATRIX_FILTER_PILLS.find((p) => p.id === id)
      if (next.has(id)) {
        next.delete(id)
      } else {
        // Exclusive within followers / sentiment / quadrant groups
        if (pill?.group === 'followers') {
          FOLLOWER_FILTERS.forEach((f) => next.delete(f))
        }
        if (pill?.group === 'sentiment') {
          SENT_FILTERS.forEach((f) => next.delete(f))
        }
        if (pill?.group === 'quad') {
          QUAD_FILTERS.forEach((f) => next.delete(f))
        }
        next.add(id)
      }
      try {
        localStorage.setItem(FILTER_KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const clearMatrixFilters = () => {
    setMatrixFilters(new Set())
    try {
      localStorage.removeItem(FILTER_KEY)
    } catch {
      /* ignore */
    }
  }

  const mapByHandle = useMemo(() => {
    const m = new Map<string, Kol>()
    for (const k of mapKols) {
      m.set(k.handle.replace(/^@/, '').toLowerCase(), k)
    }
    return m
  }, [mapKols])

  const mapHandles = useMemo(
    () => new Set(mapByHandle.keys()),
    [mapByHandle],
  )

  const baseVisible = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    return dataset.actors.filter((a) =>
      actorPassesThresholds(a, dataset.config),
    )
  }, [dataset])

  const visible = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    return baseVisible.filter((a) =>
      actorMatchesFilters(
        a,
        matrixFilters,
        mapHandles,
        dataset.config.volumeSplit,
        dataset.config.qualitySplit,
        dataset.config,
      ),
    )
  }, [dataset, baseVisible, matrixFilters, mapHandles])

  const onMapCount = useMemo(
    () => visible.filter((a) => mapHandles.has(a.handle.toLowerCase())).length,
    [visible, mapHandles],
  )

  const allPosts = useMemo(() => {
    if (!dataset) return [] as ScexPost[]
    return dataset.posts.filter((p) => !p.hidden)
  }, [dataset])

  /** Handles that actually have feed posts (for filter chips) */
  const feedKolOptions = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    const counts = new Map<string, number>()
    for (const p of allPosts) {
      const h = p.handle.toLowerCase()
      counts.set(h, (counts.get(h) || 0) + 1)
    }
    return dataset.actors
      .filter((a) => counts.has(a.handle.toLowerCase()))
      .sort((a, b) => {
        const ca = counts.get(a.handle.toLowerCase()) || 0
        const cb = counts.get(b.handle.toLowerCase()) || 0
        if (cb !== ca) return cb - ca
        return b.followers - a.followers
      })
  }, [dataset, allPosts])

  const filteredPosts = useMemo(() => {
    let list = allPosts
    if (feedFilter) {
      list = list.filter((p) => p.handle.toLowerCase() === feedFilter)
    }
    const q = feedQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.handle.toLowerCase().includes(q) ||
          p.text.toLowerCase().includes(q) ||
          (dataset?.actors.find((a) => a.handle === p.handle)?.displayName || '')
            .toLowerCase()
            .includes(q),
      )
    }
    return list.slice(0, 80)
  }, [allPosts, feedFilter, feedQuery, dataset?.actors])

  const onSelectActor = (actor: ScexActor | null) => {
    setSelectedActor(actor)
    // Sync livefeed filter when picking from matrix
    if (actor) {
      const h = actor.handle.toLowerCase()
      const hasPosts = allPosts.some((p) => p.handle.toLowerCase() === h)
      if (hasPosts) setFeedFilter(h)
    }
  }

  if (!dataset) {
    return (
      <div className="scex-loading">
        <p>Đang tải…</p>
      </div>
    )
  }

  const { config } = dataset
  if (!config.enabled) {
    return (
      <div className="scex-disabled">
        <div className="scex-card">
          <h1>{config.brandName || 'SCEX'}</h1>
          <p className="scex-empty" style={{ padding: 0 }}>
            Tracking đang tạm tắt.
          </p>
        </div>
      </div>
    )
  }

  const totalFollowers = visible.reduce((s, a) => s + (a.followers || 0), 0)
  const handle = config.brandHandle?.replace(/^@/, '') || 'scexofficial'
  const selectedMapKol = selectedActor
    ? mapByHandle.get(selectedActor.handle.toLowerCase()) || null
    : null

  return (
    <div className="scex-page">
      <header className="scex-page__hero">
        <div className="scex-page__brand">
          <div className="scex-page__logo">
            <XProfileAvatar
              handle={handle}
              name={config.brandName}
              size={52}
              liveFallback
            />
          </div>
          <div>
            <h1 className="scex-page__title">{config.brandName}</h1>
            <p className="scex-page__subtitle">
              @{handle} · cửa sổ {config.timeWindowDays} ngày · radar mention
            </p>
          </div>
        </div>
        <div className="scex-page__stats">
          <div className="scex-stat">
            <em>
              {visible.length}
              {matrixFilters.size
                ? `/${baseVisible.length}`
                : ''}
            </em>
            <span>Tài khoản</span>
          </div>
          <div className="scex-stat">
            <em>{allPosts.length}</em>
            <span>Bài viết</span>
          </div>
          <div className="scex-stat">
            <em>{onMapCount}</em>
            <span>Có trên map</span>
          </div>
          <div className="scex-stat">
            <em>{formatCompact(totalFollowers)}</em>
            <span>Tổng followers</span>
          </div>
        </div>
      </header>

      <div className="scex-page__grid">
        <section className="scex-card scex-matrix">
          <div className="scex-card__head">
            <div>
              <h2>{viMatrixTitle(config.matrixTitle)}</h2>
              <p>
                Trục ngang: tần suất · Trục dọc: chất lượng · Size: followers ·{' '}
                {visible.length}/{baseVisible.length} KOL
                {matrixFilters.size ? ' (đã lọc)' : ''} · {onMapCount} trên map
              </p>
            </div>
            <div className="scex-matrix__toolbar">
              <div className="scex-view-toggle" role="group" aria-label="Chế độ ma trận">
                <button
                  type="button"
                  className={matrixView === '2d' ? 'is-active' : ''}
                  onClick={() => setView('2d')}
                >
                  2D
                </button>
                <button
                  type="button"
                  className={matrixView === '3d' ? 'is-active' : ''}
                  onClick={() => setView('3d')}
                >
                  3D
                </button>
              </div>
              {matrixView === '3d' && (
                <button
                  type="button"
                  className={`scex-rotate-btn ${autoRotate ? 'is-on' : ''}`}
                  onClick={() => setAutoRotate((v) => !v)}
                  title="Tự xoay đám mây 3D"
                >
                  {autoRotate ? '⏸ Dừng xoay' : '▶ Tự xoay'}
                </button>
              )}
            </div>
          </div>

          <div className="scex-matrix__filters" role="toolbar" aria-label="Lọc ma trận KOL">
            <button
              type="button"
              className={`scex-matrix-pill ${matrixFilters.size === 0 ? 'is-active' : ''}`}
              onClick={clearMatrixFilters}
              title="Hiện tất cả KOL"
            >
              Tất cả
              <span className="scex-matrix-pill__n">{baseVisible.length}</span>
            </button>
            {MATRIX_FILTER_PILLS.map((pill) => {
              const active = matrixFilters.has(pill.id)
              const count = baseVisible.filter((a) =>
                actorMatchesFilters(
                  a,
                  new Set([pill.id]),
                  mapHandles,
                  config.volumeSplit,
                  config.qualitySplit,
                  config,
                ),
              ).length
              return (
                <button
                  key={pill.id}
                  type="button"
                  className={`scex-matrix-pill scex-matrix-pill--${pill.id} ${active ? 'is-active' : ''}`}
                  title={pill.title}
                  onClick={() => toggleMatrixFilter(pill.id)}
                  aria-pressed={active}
                >
                  {pill.label}
                  <span className="scex-matrix-pill__n">{count}</span>
                </button>
              )
            })}
            {matrixFilters.size > 0 && (
              <button
                type="button"
                className="scex-matrix-pill scex-matrix-pill--clear"
                onClick={clearMatrixFilters}
                title="Xóa mọi bộ lọc"
              >
                Xóa lọc ×
              </button>
            )}
          </div>
          <div
            className={`scex-matrix__body ${matrixView === '3d' ? 'scex-matrix__body--3d' : 'scex-matrix__body--2d'}`}
          >
            {matrixView === '3d' ? (
              <ScexMatrix3D
                actors={visible}
                config={config}
                selectedId={selectedActor?.id ?? null}
                mapHandles={mapHandles}
                autoRotate={autoRotate}
                onSelect={onSelectActor}
              />
            ) : (
              <ScexMatrix2D
                actors={visible}
                config={config}
                selectedId={selectedActor?.id ?? null}
                mapHandles={mapHandles}
                onSelect={onSelectActor}
              />
            )}
            <div className="scex-matrix__legend">
              <span>
                <i className="scex-matrix__legend-dot scex-matrix__legend-dot--map" />
                Có trên map Radar — bấm xem hồ sơ &amp; Surf
              </span>
              <span>
                <i className="scex-matrix__legend-dot" />
                Chỉ mention SCEX — bấm xem thống kê
              </span>
            </div>
          </div>
        </section>

        <section className="scex-card scex-feed">
          <div className="scex-card__head">
            <div>
              <h2>{viFeedTitle(config.feedTitle)}</h2>
              <p>
                {filteredPosts.length}
                {feedFilter || feedQuery
                  ? ` / ${allPosts.length}`
                  : ''}{' '}
                bài
                {feedFilter ? ` · @${feedFilter}` : ''} ·{' '}
                {allPosts.filter((p) => p.media?.length).length} có ảnh (R2)
              </p>
            </div>
          </div>

          <div className="scex-feed__filters">
            <div className="scex-feed__filter-row">
              <button
                type="button"
                className={`scex-feed__chip ${!feedFilter ? 'is-active' : ''}`}
                onClick={() => setFeedFilter(null)}
              >
                Tất cả KOL
              </button>
              {feedFilter && (
                <button
                  type="button"
                  className="scex-feed__chip is-active is-clear"
                  onClick={() => setFeedFilter(null)}
                  title="Bỏ lọc"
                >
                  @{feedFilter} ×
                </button>
              )}
              <input
                className="scex-feed__search"
                type="search"
                placeholder="Tìm handle / nội dung…"
                value={feedQuery}
                onChange={(e) => setFeedQuery(e.target.value)}
                aria-label="Tìm trong livefeed"
              />
            </div>
            <div className="scex-feed__kol-scroll" role="listbox" aria-label="Lọc theo KOL">
              {feedKolOptions.map((a) => {
                const h = a.handle.toLowerCase()
                const n = allPosts.filter((p) => p.handle.toLowerCase() === h)
                  .length
                const active = feedFilter === h
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`scex-feed__kol-chip ${active ? 'is-active' : ''}`}
                    onClick={() =>
                      setFeedFilter((prev) => (prev === h ? null : h))
                    }
                    title={`@${a.handle} · ${n} bài · ${a.followers.toLocaleString()} followers`}
                  >
                    <XProfileAvatar
                      handle={a.handle}
                      name={a.displayName}
                      size={22}
                    />
                    <span className="scex-feed__kol-chip-name">
                      {a.displayName}
                    </span>
                    <span className="scex-feed__kol-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <ul className="scex-feed__list">
            {filteredPosts.map((p, index) => (
              <ScexFeedCard
                key={p.id}
                post={p}
                actor={dataset.actors.find((a) => a.handle === p.handle)}
                sentimentLabel={config.sentimentLabels[p.sentiment]}
                onMap={mapHandles.has(p.handle.toLowerCase())}
                expanded={!!expanded[p.id]}
                onToggleExpand={() =>
                  setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                }
                onOpenActor={() => {
                  const a = dataset.actors.find(
                    (x) => x.handle === p.handle,
                  )
                  if (a) onSelectActor(a)
                }}
                index={index}
              />
            ))}
            {!filteredPosts.length && (
              <li className="scex-empty">
                {feedFilter || feedQuery
                  ? 'Không có bài khớp bộ lọc.'
                  : 'Chưa có bài trong cửa sổ này.'}
              </li>
            )}
          </ul>
        </section>
      </div>

      {selectedActor && (
        <>
          <button
            type="button"
            className="scex-detail-scrim"
            aria-label="Đóng chi tiết"
            onClick={() => setSelectedActor(null)}
          />
          <ScexKolDetail
            actor={selectedActor}
            mapKol={selectedMapKol}
            config={config}
            onClose={() => setSelectedActor(null)}
          />
        </>
      )}
    </div>
  )
}

function ScexFeedCard({
  post,
  actor,
  sentimentLabel,
  onMap,
  expanded,
  onToggleExpand,
  onOpenActor,
  index,
}: {
  post: ScexPost
  actor?: ScexActor
  sentimentLabel?: { label: string; color: string }
  onMap: boolean
  expanded: boolean
  onToggleExpand: () => void
  onOpenActor: () => void
  index: number
}) {
  const media = post.media || []
  const likes = post.likes
  const replies = post.replies
  const reposts = post.reposts
  const views = post.views
  const text = (post.text || '').trim() || '—'
  const long = text.length > 180
  const displayText =
    long && !expanded ? `${text.slice(0, 170).trim()}…` : text
  const sentColor = sentimentLabel?.color || '#64748b'

  return (
    <li
      className="scex-feed-card"
      style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
    >
      <div
        className="scex-feed-card__accent"
        style={{ background: sentColor }}
        aria-hidden
      />
      <div className="scex-feed-card__top">
        <button
          type="button"
          className="scex-feed-card__author"
          onClick={onOpenActor}
          title={onMap ? 'Xem chi tiết KOL trên map' : 'Xem thống kê SCEX'}
        >
          <div
            className="scex-feed-card__av"
            style={{ boxShadow: `0 0 0 2px ${sentColor}55` }}
          >
            <XProfileAvatar
              handle={post.handle}
              name={actor?.displayName || post.handle}
              size={42}
            />
          </div>
          <div className="scex-feed-card__meta">
            <div className="scex-feed-card__name">
              <strong>{actor?.displayName || post.handle}</strong>
              {onMap && (
                <span className="scex-pill scex-pill--map">Map</span>
              )}
              {actor?.tier && (
                <span className="scex-pill scex-pill--tier">{actor.tier}</span>
              )}
              {actor?.kind === 'kol' && (
                <span className="scex-pill scex-pill--kol">KOL</span>
              )}
              <span
                className="scex-pill scex-pill--sent"
                style={{ background: sentColor }}
              >
                {sentimentLabel?.label || post.sentiment}
              </span>
            </div>
            <span className="scex-feed-card__sub">
              @{post.handle}
              <span className="scex-feed-card__dot">·</span>
              <time dateTime={post.postedAt}>{formatTime(post.postedAt)}</time>
            </span>
          </div>
        </button>
        {post.url && (
          <a
            className="scex-feed-card__open"
            href={post.url}
            target="_blank"
            rel="noreferrer"
            title="Mở trên X"
          >
            ↗
          </a>
        )}
      </div>

      <p className={`scex-feed-card__text ${expanded ? 'is-expanded' : ''}`}>
        {displayText}
      </p>
      {long && (
        <button type="button" className="scex-feed-card__more" onClick={onToggleExpand}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}

      {media[0] && (
        <a
          href={post.url || media[0]}
          target="_blank"
          rel="noreferrer"
          className="scex-feed-media"
        >
          <img
            src={resolveMediaUrl(media[0])}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              const wrap = el.closest('.scex-feed-media') as HTMLElement | null
              if (wrap) wrap.style.display = 'none'
            }}
          />
        </a>
      )}

      {(likes != null || replies != null || reposts != null || views != null) && (
        <div className="scex-feed-metrics">
          {likes != null && (
            <span title="Likes">
              <i>♥</i> {formatCompact(likes)}
            </span>
          )}
          {reposts != null && (
            <span title="Reposts">
              <i>↻</i> {formatCompact(reposts)}
            </span>
          )}
          {replies != null && (
            <span title="Replies">
              <i>💬</i> {formatCompact(replies)}
            </span>
          )}
          {views != null && views > 0 && (
            <span title="Views">
              <i>👁</i> {formatCompact(views)}
            </span>
          )}
        </div>
      )}
    </li>
  )
}
