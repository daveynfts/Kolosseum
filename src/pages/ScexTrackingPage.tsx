/**
 * Public partner view — SCEX mention matrix (2.5D packed) + livefeed (FeedPanel-style).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  actorMatrixPos,
  actorPassesThresholds,
  actorSizeValue,
  type ScexActor,
  type ScexDataset,
  type ScexPost,
} from '../data/scexTracking'
import { loadScexWithSource } from '../lib/scexStore'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { resolveMediaUrl } from '../lib/avatar'
import './ScexTrackingPage.css'

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

type BubbleLayout = {
  id: string
  x: number
  y: number
  r: number
  z: number
  depth: number
}

/**
 * Place bubbles by volume×quality, then resolve overlaps with repulsion
 * so the matrix reads like the 2.5D map cloud (no stacked avatars).
 */
function packBubbles(
  actors: ScexActor[],
  config: ScexDataset['config'],
  width: number,
  height: number,
  maxSize: number,
): BubbleLayout[] {
  if (!actors.length || width < 40 || height < 40) return []

  const pad = 10
  const items = actors.map((a) => {
    const { x, y } = actorMatrixPos(a, config)
    const r = 16 + (actorSizeValue(a, config) / maxSize) * 26
    // Map data coords → pixels (y up in data, CSS down)
    const px = pad + r + x * Math.max(1, width - 2 * pad - 2 * r)
    const py = pad + r + (1 - y) * Math.max(1, height - 2 * pad - 2 * r)
    return {
      id: a.id,
      x: px,
      y: py,
      r,
      // Larger / higher quality → “closer” (higher z + stronger shadow)
      depth: actorSizeValue(a, config) / maxSize,
      followers: a.followers || 0,
      quality: a.qualityScore || 0,
    }
  })

  const iterations = 48
  for (let iter = 0; iter < iterations; iter++) {
    const strength = 0.55 * (1 - iter / iterations) + 0.12
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const minDist = a.r + b.r + 10
        if (dist < minDist) {
          const push = ((minDist - dist) / 2) * strength
          const ux = dx / dist
          const uy = dy / dist
          // Heavier (more followers) moves less
          const wa = 1 / (1 + Math.log10((a.followers || 1) + 1))
          const wb = 1 / (1 + Math.log10((b.followers || 1) + 1))
          const sum = wa + wb
          a.x -= ux * push * (wb / sum)
          a.y -= uy * push * (wb / sum)
          b.x += ux * push * (wa / sum)
          b.y += uy * push * (wa / sum)
        }
      }
    }
    // Soft pull back to data anchors + clamp
    for (let i = 0; i < items.length; i++) {
      const a = actors[i]
      const { x, y } = actorMatrixPos(a, config)
      const r = items[i].r
      const ax = pad + r + x * Math.max(1, width - 2 * pad - 2 * r)
      const ay = pad + r + (1 - y) * Math.max(1, height - 2 * pad - 2 * r)
      items[i].x += (ax - items[i].x) * 0.04
      items[i].y += (ay - items[i].y) * 0.04
      items[i].x = Math.min(width - r - pad, Math.max(r + pad, items[i].x))
      items[i].y = Math.min(height - r - pad, Math.max(r + pad, items[i].y))
    }
  }

  return items
    .map((it) => ({
      id: it.id,
      x: it.x,
      y: it.y,
      r: it.r,
      depth: it.depth,
      z: Math.round(10 + it.depth * 40 + it.quality * 0.15),
    }))
    .sort((a, b) => a.z - b.z)
}

export function ScexTrackingPage() {
  const [dataset, setDataset] = useState<ScexDataset | null>(null)
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void loadScexWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    return dataset.actors.filter((a) =>
      actorPassesThresholds(a, dataset.config),
    )
  }, [dataset])

  // Measure matrix plot for pixel packing
  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setPlotSize({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dataset?.config.enabled])

  if (!dataset) {
    return (
      <div className="scex-loading">
        <p>Loading…</p>
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
            Tracking is currently offline.
          </p>
        </div>
      </div>
    )
  }

  const sizes = visible.map((a) => actorSizeValue(a, config))
  const maxSize = Math.max(...sizes, 1)
  const posts = dataset.posts.filter((p) => !p.hidden).slice(0, 50)
  const totalFollowers = visible.reduce((s, a) => s + (a.followers || 0), 0)
  const handle = config.brandHandle?.replace(/^@/, '') || 'scexofficial'

  const packed = packBubbles(visible, config, plotSize.w, plotSize.h, maxSize)
  const packedById = new Map(packed.map((b) => [b.id, b]))
  const actorById = new Map(visible.map((a) => [a.id, a]))

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
              @{handle} · {config.timeWindowDays}d window · mention radar
            </p>
          </div>
        </div>
        <div className="scex-page__stats">
          <div className="scex-stat">
            <em>{visible.length}</em>
            <span>Accounts</span>
          </div>
          <div className="scex-stat">
            <em>{posts.length}</em>
            <span>Posts</span>
          </div>
          <div className="scex-stat">
            <em>{formatCompact(totalFollowers)}</em>
            <span>Followers Σ</span>
          </div>
        </div>
      </header>

      <div className="scex-page__grid">
        <section className="scex-card scex-matrix">
          <div className="scex-card__head">
            <h2>{config.matrixTitle}</h2>
            <p>
              Volume × quality · 2.5D pack · size by{' '}
              {config.sizeMetric === 'reach7d' ? 'reach' : 'followers'}
            </p>
          </div>
          <div className="scex-matrix__body">
            <div className="scex-matrix__plot" ref={plotRef}>
              <div className="scex-matrix__quad scex-matrix__quad--nurture">
                <strong>{config.quadrantLabels.nurture?.title}</strong>
                <small>{config.quadrantLabels.nurture?.subtitle}</small>
              </div>
              <div className="scex-matrix__quad scex-matrix__quad--stars">
                <strong>{config.quadrantLabels.stars?.title}</strong>
                <small>{config.quadrantLabels.stars?.subtitle}</small>
              </div>
              <div className="scex-matrix__quad scex-matrix__quad--ignore">
                <strong>{config.quadrantLabels.ignore?.title}</strong>
                <small>{config.quadrantLabels.ignore?.subtitle}</small>
              </div>
              <div className="scex-matrix__quad scex-matrix__quad--noise">
                <strong>{config.quadrantLabels.noise?.title}</strong>
                <small>{config.quadrantLabels.noise?.subtitle}</small>
              </div>

              <div className="scex-matrix__stage" aria-hidden={false}>
                {packed.map((b) => {
                  const a = actorById.get(b.id)
                  if (!a) return null
                  const ring =
                    config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
                  const diam = b.r * 2
                  const selected = selectedId === a.id
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`scex-bubble ${selected ? 'is-selected' : ''}`}
                      style={{
                        left: b.x,
                        top: b.y,
                        width: diam,
                        height: diam,
                        borderColor: ring,
                        zIndex: selected ? 80 : b.z,
                        ['--depth' as string]: String(b.depth),
                        ['--ring' as string]: ring,
                      }}
                      title={`@${a.handle} · V${a.postsVolume} · Q${a.qualityScore} · ${formatCompact(a.followers)}`}
                      onClick={() =>
                        setSelectedId((prev) => (prev === a.id ? null : a.id))
                      }
                    >
                      <span className="scex-bubble__glow" aria-hidden />
                      <span className="scex-bubble__disc">
                        <XProfileAvatar
                          handle={a.handle}
                          name={a.displayName}
                          size={Math.max(24, Math.round(diam - 6))}
                        />
                      </span>
                      <span className="scex-bubble__label">
                        @{a.handle.length > 10 ? `${a.handle.slice(0, 9)}…` : a.handle}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="scex-matrix__axis-x">
              {config.volumeAxis.label} →
            </div>
            <div className="scex-matrix__axis-y">
              ↑ {config.qualityAxis.label}
            </div>
            {selectedId && packedById.has(selectedId) && (
              <div className="scex-matrix__tip">
                {(() => {
                  const a = actorById.get(selectedId)
                  if (!a) return null
                  return (
                    <>
                      <strong>
                        {a.displayName}{' '}
                        <span>@{a.handle}</span>
                      </strong>
                      <span>
                        V{a.postsVolume} · Q{a.qualityScore} ·{' '}
                        {formatCompact(a.followers)} followers · {a.sentiment}
                      </span>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </section>

        <section className="scex-card scex-feed">
          <div className="scex-card__head">
            <h2>{config.feedTitle}</h2>
            <p>
              {posts.length} recent ·{' '}
              {posts.filter((p) => p.media?.length).length} with media (R2)
            </p>
          </div>
          <ul className="scex-feed__list">
            {posts.map((p, index) => (
              <ScexFeedCard
                key={p.id}
                post={p}
                actor={dataset.actors.find((a) => a.handle === p.handle)}
                sentimentLabel={config.sentimentLabels[p.sentiment]}
                expanded={!!expanded[p.id]}
                onToggleExpand={() =>
                  setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                }
                index={index}
              />
            ))}
            {!posts.length && (
              <li className="scex-empty">No posts in this window yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

function ScexFeedCard({
  post,
  actor,
  sentimentLabel,
  expanded,
  onToggleExpand,
  index,
}: {
  post: ScexPost
  actor?: ScexActor
  sentimentLabel?: { label: string; color: string }
  expanded: boolean
  onToggleExpand: () => void
  index: number
}) {
  // Media is pre-cached to R2 by scripts/hydrate_scex_media.mjs (no runtime X API)
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
        <div className="scex-feed-card__author">
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
        </div>
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
