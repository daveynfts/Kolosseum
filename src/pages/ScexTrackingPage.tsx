/**
 * Public / partner preview of SCEX tracking matrix + livefeed.
 * Data from R2 via /api/scex-tracking (admin-configured).
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
import './AdminDashboard.css'

export function ScexTrackingPage() {
  const [dataset, setDataset] = useState<ScexDataset | null>(null)
  const [source, setSource] = useState<string>('loading')

  useEffect(() => {
    let cancelled = false
    void loadScexWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
      setSource(r.source)
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
      <div className="admin-root scex-public">
        <p className="muted" style={{ padding: 24 }}>
          Loading SCEX tracking…
        </p>
      </div>
    )
  }

  const { config } = dataset
  if (!config.enabled) {
    return (
      <div className="admin-root scex-public">
        <div className="glass" style={{ margin: 24, padding: 24 }}>
          <h1>SCEX Tracking</h1>
          <p className="muted">
            Tracking is disabled. Enable in Admin → SCEX → Settings.
          </p>
          <a href="#/admin/scex">Open admin</a>
        </div>
      </div>
    )
  }

  const sizes = visible.map((a) => actorSizeValue(a, config))
  const maxSize = Math.max(...sizes, 1)
  const posts = dataset.posts.filter((p) => !p.hidden).slice(0, 50)

  return (
    <div className="admin-root scex-public">
      <header className="admin-header glass" style={{ marginBottom: 12 }}>
        <div>
          <h1>
            {config.brandName} · Tracking
            <span className="admin-badge">partner</span>
          </h1>
          <p className="admin-sub">
            Window {config.timeWindowDays}d · source {source} ·{' '}
            <a href="#/admin/scex">Admin edit</a> ·{' '}
            <a href="#/">Map</a>
          </p>
        </div>
      </header>

      <div className="admin-scex-preview">
        <div className="admin-scex-matrix glass">
          <header className="admin-scex-matrix__head">
            <h3>{config.matrixTitle}</h3>
            <p className="muted">
              {visible.length} accounts · X volume · Y quality · size{' '}
              {config.sizeMetric}
            </p>
          </header>
          <div className="admin-scex-matrix__plot">
            <div className="admin-scex-matrix__quad admin-scex-matrix__quad--nurture">
              <span>{config.quadrantLabels.nurture?.title}</span>
              <small>{config.quadrantLabels.nurture?.subtitle}</small>
            </div>
            <div className="admin-scex-matrix__quad admin-scex-matrix__quad--stars">
              <span>{config.quadrantLabels.stars?.title}</span>
              <small>{config.quadrantLabels.stars?.subtitle}</small>
            </div>
            <div className="admin-scex-matrix__quad admin-scex-matrix__quad--ignore">
              <span>{config.quadrantLabels.ignore?.title}</span>
              <small>{config.quadrantLabels.ignore?.subtitle}</small>
            </div>
            <div className="admin-scex-matrix__quad admin-scex-matrix__quad--noise">
              <span>{config.quadrantLabels.noise?.title}</span>
              <small>{config.quadrantLabels.noise?.subtitle}</small>
            </div>
            <div className="admin-scex-matrix__cross-v" />
            <div className="admin-scex-matrix__cross-h" />
            {visible.map((a) => {
              const { x, y } = actorMatrixPos(a, config)
              const sz = 22 + (actorSizeValue(a, config) / maxSize) * 40
              const ring =
                config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
              return (
                <div
                  key={a.id}
                  className="admin-scex-bubble"
                  style={{
                    left: `${x * 100}%`,
                    bottom: `${y * 100}%`,
                    width: sz,
                    height: sz,
                    borderColor: ring,
                  }}
                  title={`@${a.handle}`}
                >
                  <XProfileAvatar
                    handle={a.handle}
                    name={a.displayName}
                    size={Math.max(18, sz - 8)}
                  />
                </div>
              )
            })}
          </div>
          <div className="admin-scex-matrix__axis-x">
            {config.volumeAxis.label} →
          </div>
          <div className="admin-scex-matrix__axis-y">
            ↑ {config.qualityAxis.label}
          </div>
        </div>

        <div className="admin-scex-feed glass">
          <header>
            <h3>{config.feedTitle}</h3>
            <p className="muted">{posts.length} posts</p>
          </header>
          <ul className="admin-scex-feed-list">
            {posts.map((p) => {
              const sent = config.sentimentLabels[p.sentiment]
              const actor = dataset.actors.find((a) => a.handle === p.handle)
              return (
                <li key={p.id} className="admin-scex-feed-item">
                  <XProfileAvatar
                    handle={p.handle}
                    name={actor?.displayName || p.handle}
                    size={40}
                  />
                  <div className="admin-scex-feed-item__body">
                    <div className="admin-scex-feed-item__meta">
                      <strong>@{p.handle}</strong>
                      {actor?.tier && (
                        <span className="admin-scex-tier">{actor.tier}</span>
                      )}
                      {actor?.kind === 'kol' && (
                        <span className="admin-scex-tier admin-scex-tier--kol">
                          KOL
                        </span>
                      )}
                      <span
                        className="admin-scex-sent-badge"
                        style={{ background: sent?.color || '#64748b' }}
                      >
                        {sent?.label || p.sentiment}
                      </span>
                      <time>{p.postedAt.slice(0, 16)}</time>
                    </div>
                    <p>{p.text || '—'}</p>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Open on X ↗
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
            {!posts.length && (
              <li className="muted">No posts yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
