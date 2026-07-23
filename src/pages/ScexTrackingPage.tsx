/**
 * Public partner view — SCEX mention matrix + livefeed.
 * Clean product UI (no admin chrome).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  actorMatrixPos,
  actorPassesThresholds,
  actorSizeValue,
  type ScexActor,
  type ScexDataset,
} from '../data/scexTracking'
import { loadScexWithSource } from '../lib/scexStore'
import { XProfileAvatar } from '../components/XProfileAvatar'
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

export function ScexTrackingPage() {
  const [dataset, setDataset] = useState<ScexDataset | null>(null)

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
              Volume × quality · size by{' '}
              {config.sizeMetric === 'reach7d' ? 'reach' : 'followers'}
            </p>
          </div>
          <div className="scex-matrix__body">
            <div className="scex-matrix__plot">
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
              {visible.map((a) => {
                const { x, y } = actorMatrixPos(a, config)
                const sz = 28 + (actorSizeValue(a, config) / maxSize) * 44
                const ring =
                  config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
                return (
                  <div
                    key={a.id}
                    className="scex-bubble"
                    style={{
                      left: `${Math.min(96, Math.max(4, x * 100))}%`,
                      bottom: `${Math.min(96, Math.max(4, y * 100))}%`,
                      width: sz,
                      height: sz,
                      borderColor: ring,
                    }}
                    title={`@${a.handle} · V${a.postsVolume} · Q${a.qualityScore}`}
                  >
                    <XProfileAvatar
                      handle={a.handle}
                      name={a.displayName}
                      size={Math.max(22, Math.round(sz - 8))}
                    />
                  </div>
                )
              })}
            </div>
            <div className="scex-matrix__axis-x">
              {config.volumeAxis.label} →
            </div>
            <div className="scex-matrix__axis-y">
              ↑ {config.qualityAxis.label}
            </div>
          </div>
        </section>

        <section className="scex-card scex-feed">
          <div className="scex-card__head">
            <h2>{config.feedTitle}</h2>
            <p>{posts.length} recent</p>
          </div>
          <ul className="scex-feed__list">
            {posts.map((p) => {
              const sent = config.sentimentLabels[p.sentiment]
              const actor = dataset.actors.find((a) => a.handle === p.handle)
              return (
                <li key={p.id} className="scex-feed-item">
                  <XProfileAvatar
                    handle={p.handle}
                    name={actor?.displayName || p.handle}
                    size={42}
                  />
                  <div className="scex-feed-item__body">
                    <div className="scex-feed-item__meta">
                      <strong>
                        {actor?.displayName || p.handle}
                      </strong>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                        @{p.handle}
                      </span>
                      {actor?.tier && (
                        <span className="scex-pill scex-pill--tier">
                          {actor.tier}
                        </span>
                      )}
                      {actor?.kind === 'kol' && (
                        <span className="scex-pill scex-pill--kol">KOL</span>
                      )}
                      <span
                        className="scex-pill scex-pill--sent"
                        style={{ background: sent?.color || '#64748b' }}
                      >
                        {sent?.label || p.sentiment}
                      </span>
                      <time>{formatTime(p.postedAt)}</time>
                    </div>
                    <p>{p.text || '—'}</p>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        View on X ↗
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
            {!posts.length && (
              <li className="scex-empty">No posts in this window yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
