/**
 * KOL detail drawer for SCEX matrix — reuses map overview + Surf when KOL is on map.
 */
import { useEffect, useState } from 'react'
import type { Kol } from '../types'
import {
  formatStatus,
  getKolNiches,
  NICHE_COLORS,
  primaryNiche,
  STATUS_LABELS,
} from '../types'
import type { ScexActor, ScexConfig } from '../data/scexTracking'
import { AvatarImg } from './AvatarImg'
import { BioRichText } from './BioRichText'
import { RankBadge } from './RankBadge'
import { SurfAnalysisMock } from './SurfAnalysisMock'
import { XProfileAvatar } from './XProfileAvatar'

type Tab = 'overview' | 'analysis' | 'scex'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

export function ScexKolDetail({
  actor,
  mapKol,
  config,
  onClose,
}: {
  actor: ScexActor
  mapKol: Kol | null
  config: ScexConfig
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>(mapKol ? 'overview' : 'scex')
  const sent = config.sentimentLabels[actor.sentiment]

  useEffect(() => {
    setTab(mapKol ? 'overview' : 'scex')
  }, [actor.id, mapKol?.id])

  const accent = mapKol
    ? NICHE_COLORS[primaryNiche(mapKol)]
    : sent?.color || '#38bdf8'

  return (
    <aside className="scex-detail glass">
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
            size={52}
            color={accent}
            avatarUrl={mapKol.avatarUrl}
            className="scex-detail__avatar"
          />
        ) : (
          <div className="scex-detail__avatar">
            <XProfileAvatar
              handle={actor.handle}
              name={actor.displayName}
              size={52}
            />
          </div>
        )}
        <div>
          <h2>{mapKol?.displayName || actor.displayName}</h2>
          <a
            className="scex-detail__handle"
            href={`https://x.com/${actor.handle}`}
            target="_blank"
            rel="noreferrer"
          >
            @{actor.handle}
          </a>
          {mapKol ? (
            <span className="scex-detail__badge scex-detail__badge--map">
              Có trên map Radar
            </span>
          ) : (
            <span className="scex-detail__badge">Chưa có trên map</span>
          )}
        </div>
      </div>

      <div className="scex-detail__tabs" role="tablist">
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
        <button
          type="button"
          role="tab"
          className={`scex-detail__tab ${tab === 'scex' ? 'is-active' : ''}`}
          aria-selected={tab === 'scex'}
          onClick={() => setTab('scex')}
        >
          SCEX
        </button>
      </div>

      {tab === 'scex' && (
        <div className="scex-detail__body">
          <div className="scex-detail__stats">
            <div>
              <span>Lần nhắc</span>
              <strong>{actor.postsVolume}</strong>
            </div>
            <div>
              <span>Chất lượng</span>
              <strong>{actor.qualityScore}</strong>
            </div>
            <div>
              <span>Followers</span>
              <strong>{fmt(actor.followers)}</strong>
            </div>
            <div>
              <span>Cảm xúc</span>
              <strong style={{ color: sent?.color }}>{sent?.label || actor.sentiment}</strong>
            </div>
          </div>
          {actor.tier && (
            <p className="scex-detail__meta">
              Hạng mention: <em>{actor.tier}</em>
              {actor.kind === 'kol' ? ' · KOL' : ''}
            </p>
          )}
          {actor.notes && <p className="scex-detail__notes">{actor.notes}</p>}
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
              <span className="scex-detail__tag" title={STATUS_LABELS[mapKol.statusLabel]}>
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
                {mapKol.activity7dPosts != null ? mapKol.activity7dPosts : '—'}
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
    </aside>
  )
}
