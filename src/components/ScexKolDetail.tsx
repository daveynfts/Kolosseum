/**
 * Near-fullscreen KOL panel for SCEX matrix.
 * SCEX tab: stats + feed of this KOL's SCEX mentions.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Kol } from '../types'
import {
  formatStatus,
  getKolNiches,
  NICHE_COLORS,
  primaryNiche,
  STATUS_LABELS,
} from '../types'
import type { ScexActor, ScexConfig, ScexPost } from '../data/scexTracking'
import { actorVolumeMetric } from '../data/scexTracking'
import { AvatarImg } from './AvatarImg'
import { BioRichText } from './BioRichText'
import { RankBadge } from './RankBadge'
import { SurfAnalysisMock } from './SurfAnalysisMock'
import { XProfileAvatar } from './XProfileAvatar'
import { resolveMediaUrl } from '../lib/avatar'

type Tab = 'overview' | 'analysis' | 'scex'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ScexKolDetail({
  actor,
  mapKol,
  config,
  posts,
  onClose,
}: {
  actor: ScexActor
  mapKol: Kol | null
  config: ScexConfig
  /** Posts by this actor mentioning SCEX (already filtered) */
  posts: ScexPost[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('scex')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const sent = config.sentimentLabels[actor.sentiment]

  useEffect(() => {
    setTab('scex')
    setExpanded({})
  }, [actor.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accent = mapKol
    ? NICHE_COLORS[primaryNiche(mapKol)]
    : sent?.color || '#38bdf8'

  const vol = Math.round(actorVolumeMetric(actor, config))
  const sortedPosts = useMemo(() => {
    return [...posts].sort(
      (a, b) =>
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
    )
  }, [posts])

  return (
    <aside
      className="scex-detail glass"
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết @${actor.handle}`}
    >
      <button
        type="button"
        className="scex-detail__close"
        onClick={onClose}
        aria-label="Đóng"
      >
        ×
      </button>
      <div className="scex-detail__accent" style={{ background: accent }} />

      <div className="scex-detail__head">
        {mapKol ? (
          <AvatarImg
            handle={mapKol.handle}
            name={mapKol.displayName}
            size={56}
            color={accent}
            avatarUrl={mapKol.avatarUrl}
            className="scex-detail__avatar"
          />
        ) : (
          <div className="scex-detail__avatar">
            <XProfileAvatar
              handle={actor.handle}
              name={actor.displayName}
              size={56}
              liveFallback
            />
          </div>
        )}
        <div className="scex-detail__head-text">
          <h2>{mapKol?.displayName || actor.displayName}</h2>
          <a
            className="scex-detail__handle"
            href={`https://x.com/${actor.handle}`}
            target="_blank"
            rel="noreferrer"
          >
            @{actor.handle}
          </a>
          <div className="scex-detail__head-badges">
            {mapKol ? (
              <span className="scex-detail__badge scex-detail__badge--map">
                Map Radar
              </span>
            ) : (
              <span className="scex-detail__badge">Off-map</span>
            )}
            {actor.quadrant && (
              <span className="scex-detail__badge">
                {config.quadrantLabels[actor.quadrant]?.title || actor.quadrant}
              </span>
            )}
            <span
              className="scex-detail__badge"
              style={{
                color: sent?.color,
                borderColor: `${sent?.color || '#94a3b8'}55`,
              }}
            >
              {sent?.label || actor.sentiment}
            </span>
          </div>
        </div>
      </div>

      <div className="scex-detail__quick">
        <div>
          <span>Mentions</span>
          <strong>{actor.postsVolume}</strong>
        </div>
        <div>
          <span>Volume</span>
          <strong>{vol}</strong>
        </div>
        <div>
          <span>Quality</span>
          <strong>{Math.round(actor.qualityScore)}</strong>
        </div>
        <div>
          <span>Followers</span>
          <strong>{fmt(actor.followers)}</strong>
        </div>
        <div>
          <span>Feed</span>
          <strong>{sortedPosts.length}</strong>
        </div>
      </div>

      <div className="scex-detail__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`scex-detail__tab ${tab === 'scex' ? 'is-active' : ''}`}
          aria-selected={tab === 'scex'}
          onClick={() => setTab('scex')}
        >
          SCEX
          {sortedPosts.length > 0 && (
            <em className="scex-detail__tab-n">{sortedPosts.length}</em>
          )}
        </button>
        {mapKol && (
          <button
            type="button"
            role="tab"
            className={`scex-detail__tab ${tab === 'overview' ? 'is-active' : ''}`}
            aria-selected={tab === 'overview'}
            onClick={() => setTab('overview')}
          >
            Tổng quan
          </button>
        )}
        {mapKol && (
          <button
            type="button"
            role="tab"
            className={`scex-detail__tab ${tab === 'analysis' ? 'is-active' : ''}`}
            aria-selected={tab === 'analysis'}
            onClick={() => setTab('analysis')}
          >
            Surf AI
          </button>
        )}
      </div>

      <div className="scex-detail__scroll">
        {tab === 'scex' && (
          <div className="scex-detail__body">
            <div className="scex-detail__stats">
              <div>
                <span>Gốc / Reply</span>
                <strong>
                  {actor.gocPosts ?? '—'} / {actor.replyPosts ?? '—'}
                </strong>
              </div>
              <div>
                <span>Reach 7d</span>
                <strong>
                  {actor.reach7d != null ? fmt(actor.reach7d) : '—'}
                </strong>
              </div>
              <div>
                <span>Map tier</span>
                <strong>{actor.mapRank || actor.tier || '—'}</strong>
              </div>
              <div>
                <span>Cảm xúc</span>
                <strong style={{ color: sent?.color }}>
                  {sent?.label || actor.sentiment}
                </strong>
              </div>
            </div>
            {actor.notes && (
              <p className="scex-detail__notes">{actor.notes}</p>
            )}

            <div className="scex-detail__feed-head">
              <h3>Bài mention SCEX</h3>
              <span>{sortedPosts.length} bài</span>
            </div>

            {sortedPosts.length === 0 ? (
              <p className="scex-detail__feed-empty">
                Chưa có bài mention SCEX trong cửa sổ tracking cho @{actor.handle}.
              </p>
            ) : (
              <ul className="scex-detail__feed">
                {sortedPosts.map((p) => {
                  const open = !!expanded[p.id]
                  const text = p.text || ''
                  const long = text.length > 220
                  const show = open || !long ? text : `${text.slice(0, 200)}…`
                  const sLab = config.sentimentLabels[p.sentiment]
                  const media = (p.media || []).filter(Boolean)
                  return (
                    <li key={p.id} className="scex-detail__post">
                      <div className="scex-detail__post-meta">
                        <time dateTime={p.postedAt}>
                          {formatWhen(p.postedAt)}
                        </time>
                        <span
                          className="scex-detail__post-sent"
                          style={{ color: sLab?.color || '#94a3b8' }}
                        >
                          {sLab?.label || p.sentiment}
                        </span>
                      </div>
                      <p className="scex-detail__post-text">{show}</p>
                      {long && (
                        <button
                          type="button"
                          className="scex-detail__post-more"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [p.id]: !prev[p.id],
                            }))
                          }
                        >
                          {open ? 'Thu gọn' : 'Xem thêm'}
                        </button>
                      )}
                      {media.length > 0 && (
                        <div className="scex-detail__post-media">
                          {media.slice(0, 3).map((m, i) => (
                            <a
                              key={i}
                              href={resolveMediaUrl(m)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={resolveMediaUrl(m)}
                                alt=""
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="scex-detail__post-foot">
                        <span>
                          {p.likes != null ? `${fmt(p.likes)} likes` : ''}
                          {p.views != null
                            ? ` · ${fmt(p.views)} views`
                            : ''}
                        </span>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem trên X ↗
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <a
              className="scex-detail__xlink"
              href={`https://x.com/${actor.handle}`}
              target="_blank"
              rel="noreferrer"
            >
              Mở profile X ↗
            </a>
          </div>
        )}

        {tab === 'overview' && mapKol && (
          <div className="scex-detail__body">
            <p className="scex-detail__label">Hoạt động &amp; assessment (AI)</p>
            <BioRichText
              text={mapKol.bio || ''}
              className="scex-detail__bio"
            />
            <div className="scex-detail__tags">
              <RankBadge
                tier={mapKol.tier}
                score={mapKol.score}
                isTop30={mapKol.isTop30}
                rank={mapKol.rank}
                size="sm"
              />
              {mapKol.statusLabel && (
                <span
                  className="scex-detail__tag"
                  title={STATUS_LABELS[mapKol.statusLabel]}
                >
                  {formatStatus(mapKol.statusLabel)}
                </span>
              )}
              {getKolNiches(mapKol).map((n) => (
                <span
                  key={n}
                  className="scex-detail__tag"
                  style={{
                    color: NICHE_COLORS[n],
                    borderColor: `${NICHE_COLORS[n]}55`,
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="scex-detail__stats">
              <div>
                <span>Followers (X)</span>
                <strong>{fmt(mapKol.followers)}</strong>
              </div>
              <div>
                <span>Score</span>
                <strong>{mapKol.score.toFixed(1)}</strong>
              </div>
              <div>
                <span>7d posts</span>
                <strong>
                  {mapKol.activity7dPosts != null
                    ? mapKol.activity7dPosts
                    : '—'}
                </strong>
              </div>
              <div>
                <span>Lần nhắc SCEX</span>
                <strong>{actor.postsVolume}</strong>
              </div>
            </div>
          </div>
        )}

        {tab === 'analysis' && mapKol && (
          <div className="scex-detail__body scex-detail__body--surf">
            <SurfAnalysisMock kol={mapKol} />
          </div>
        )}
      </div>
    </aside>
  )
}
