import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Kol, KolRank, Niche, StatusLabel } from '../types'
import {
  formatRank,
  formatStatus,
  getKolNiches,
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  RANK_COLORS,
  RANK_LABELS,
  RANK_ORDER,
  RANK_SHORT,
  STATUS_EMOJI,
  STATUS_LABELS,
} from '../types'
import type { ViewMode } from '../lib/layout'
import { AvatarImg } from './AvatarImg'
import { RankBadge } from './RankBadge'
import { SurfAnalysisMock } from './SurfAnalysisMock'
import { RecentFollowersPanel } from './RecentFollowersPanel'
import { getRecentFollowers } from '../data/recentFollowers'

const NICHES: Array<Niche | 'All'> = [
  'All',
  'Trading',
  'Research',
  'Airdrop',
  'News',
  'OTC',
  'DeFi',
  'GameFi',
  'NFT',
  'Meme',
  'Multi',
]

const STATUSES: Array<StatusLabel | 'All'> = [
  'All',
  'hot',
  'active',
  'stable',
  'quiet',
  'dormant',
]

interface Props {
  kols: Kol[]
  allKols: Kol[]
  selected: Kol | null
  filterNiche: Niche | 'All'
  filterRank: KolRank | 'All'
  filterStatus: StatusLabel | 'All'
  shortlistIds: string[]
  autoRotate: boolean
  viewMode: ViewMode
  feedOpen: boolean
  compareOpen: boolean
  onFilter: (n: Niche | 'All') => void
  onFilterRank: (r: KolRank | 'All') => void
  onFilterStatus: (s: StatusLabel | 'All') => void
  onSelect: (kol: Kol | null) => void
  onToggleRotate: () => void
  onViewMode: (mode: ViewMode) => void
  onToggleFeed: () => void
  onToggleCompare: () => void
  onToggleShortlist: (kol: Kol) => void
}

export function Hud({
  kols,
  allKols: _allKols,
  selected,
  filterNiche,
  filterRank,
  filterStatus,
  shortlistIds,
  autoRotate,
  viewMode,
  feedOpen,
  compareOpen,
  onFilter,
  onFilterRank,
  onFilterStatus,
  onSelect,
  onToggleRotate,
  onViewMode,
  onToggleFeed,
  onToggleCompare,
  onToggleShortlist,
}: Props) {
  const hotCount = kols.filter((k) => k.statusLabel === 'hot').length
  const top = useMemo(
    () =>
      [...kols]
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.followers - a.followers ||
            a.handle.localeCompare(b.handle),
        )
        .slice(0, 10),
    [kols],
  )
  const inShortlist = selected ? shortlistIds.includes(selected.id) : false
  const [detailTab, setDetailTab] = useState<
    'overview' | 'analysis' | 'follows'
  >('overview')

  useEffect(() => {
    setDetailTab('overview')
  }, [selected?.id])

  return (
    <>
      <header className="hud-bar glass">
        <div className="hud-bar__brand">
          <div className="brand-mark brand-mark--sm" />
          <h1>VN KOL Map</h1>
        </div>

        {/* Always visible — not after filter chips */}
        <div
          className="view-toggle view-toggle--bar"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            className={viewMode === '2d' ? 'is-active' : ''}
            onClick={() => onViewMode('2d')}
            title="2.5D — cloud 3D, render nhẹ"
            aria-pressed={viewMode === '2d'}
          >
            2.5D
          </button>
          <button
            type="button"
            className={viewMode === '3d' ? 'is-active' : ''}
            onClick={() => onViewMode('3d')}
            title="3D full — liquid glass"
            aria-pressed={viewMode === '3d'}
          >
            3D
          </button>
        </div>

        <div className="hud-bar__divider" aria-hidden />

        <div className="hud-bar__filters">
          <div className="filter-seg filter-seg--inline filter-seg--ranks" title="Rank">
            <button
              type="button"
              className={`seg-btn ${filterRank === 'All' ? 'is-active' : ''}`}
              onClick={() => onFilterRank('All')}
              title="Show all ranks"
            >
              All
            </button>
            {RANK_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                className={`seg-btn seg-btn--rank ${filterRank === r ? 'is-active' : ''}`}
                style={
                  {
                    ['--rank' as string]: RANK_COLORS[r],
                  } as CSSProperties
                }
                onClick={() => onFilterRank(r)}
                title={
                  filterRank === r
                    ? 'Click again to clear'
                    : `Filter ${RANK_LABELS[r]}`
                }
              >
                <RankBadge rank={r} size="pip" className="rank-pip--filter" />
                <span className="seg-btn__rank-label">{RANK_SHORT[r]}</span>
              </button>
            ))}
          </div>

          <div className="filter-chips filter-chips--inline" title="Status">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip chip--status chip--emoji chip--sm ${filterStatus === s ? 'chip--active' : ''}`}
                onClick={() => onFilterStatus(s)}
                title={
                  s === 'All'
                    ? 'Show all status'
                    : filterStatus === s
                      ? 'Click again to clear'
                      : `Filter ${STATUS_LABELS[s]}`
                }
              >
                {s === 'All' ? (
                  'All'
                ) : (
                  <span className="chip-emoji" aria-hidden>
                    {STATUS_EMOJI[s]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="filter-chips filter-chips--inline" title="Niche">
            {NICHES.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip chip--sm chip--niche ${filterNiche === n ? 'chip--active' : ''}`}
                style={
                  n !== 'All'
                    ? ({
                        ['--chip-color' as string]: NICHE_COLORS[n],
                      } as CSSProperties)
                    : undefined
                }
                onClick={() => onFilter(n)}
                title={
                  n === 'All'
                    ? 'Show all niches'
                    : filterNiche === n
                      ? 'Click again to clear'
                      : `Filter ${n}`
                }
              >
                {n !== 'All' && <i className="chip-dot" />}
                {n === 'All' ? 'All' : n}
              </button>
            ))}
          </div>
        </div>

        <div className="hud-bar__actions">
          {hotCount > 0 && (
            <span className="pill pill--hot pill--sm">{hotCount} hot</span>
          )}
          <button
            type="button"
            className={`pill pill--btn pill--sm ${feedOpen ? 'pill--live' : ''}`}
            onClick={onToggleFeed}
          >
            <span className="live-dot live-dot--sm" />
            Feed
          </button>
          <button
            type="button"
            className={`pill pill--btn pill--sm ${compareOpen ? 'pill--active' : ''}`}
            onClick={onToggleCompare}
          >
            ★ {shortlistIds.length}
          </button>
        </div>
      </header>

      <aside className="hud-left">
        <div className="panel glass panel--rank">
          <div className="panel-head">
            <div>
              <div className="panel-title">Top Score</div>
              <div className="panel-sub">
                {kols.length} visible · sorted by composite
              </div>
            </div>
            <span className="panel-badge">{top.length}</span>
          </div>
          {top.length === 0 ? (
            <div className="rank-empty">No KOLs match filters</div>
          ) : (
            <ul className="rank-list" onWheel={(e) => e.stopPropagation()}>
              {top.map((k, i) => {
                const starred = shortlistIds.includes(k.id)
                const active = selected?.id === k.id
                const rankClass =
                  i === 0 ? 'is-gold' : i === 1 ? 'is-silver' : i === 2 ? 'is-bronze' : ''
                return (
                  <li key={k.id} className={`rank-item ${active ? 'is-selected' : ''}`}>
                    <div className="rank-row">
                      <button
                        type="button"
                        className="rank-main-btn"
                        onClick={() => onSelect(k)}
                      >
                        <span className={`rank-i ${rankClass}`}>{i + 1}</span>
                        <span className="rank-avatar-wrap">
                          <AvatarImg
                            handle={k.handle}
                            name={k.displayName}
                            size={34}
                            color={NICHE_COLORS[primaryNiche(k)]}
                            className="rank-avatar"
                          />
                          <RankBadge
                            tier={k.tier}
                            score={k.score}
                            isTop30={k.isTop30}
                            size="pip"
                            className="rank-pip--list"
                          />
                        </span>
                        <span className="rank-main">
                          <strong title={k.displayName}>
                            {k.displayName}
                          </strong>
                          <small>
                            @{k.handle}
                            <span
                              className="rank-inline"
                              style={{
                                color: RANK_COLORS[getKolRank(k)],
                              }}
                            >
                              {' '}
                              · {formatRank(k)}
                            </span>
                            {k.isTop30 ? ' · 7d' : ''}
                            {getKolNiches(k).length > 1
                              ? ` · ${getKolNiches(k).join('+')}`
                              : ''}
                          </small>
                          <span className="rank-meta-row">
                            <span
                              className="rank-status rank-status--emoji"
                              title={STATUS_LABELS[(k.statusLabel ?? 'stable') as StatusLabel]}
                            >
                              {formatStatus(k.statusLabel)}
                            </span>
                            <span>{fmt(k.followers)}</span>
                            {k.activity7dPosts != null && (
                              <span>
                                {k.activity7dPosts}p/7d
                                {k.activity7dSource === 'sampled' ? '*' : '≈'}
                              </span>
                            )}
                          </span>
                          <span className="rank-bar">
                            <i
                              style={{
                                width: `${Math.min(100, k.score)}%`,
                                background: `linear-gradient(90deg, ${NICHE_COLORS[primaryNiche(k)]}, rgba(255,255,255,0.55))`,
                              }}
                            />
                          </span>
                        </span>
                        <span className="rank-score-wrap">
                          <span
                            className="rank-score"
                            style={{ color: NICHE_COLORS[primaryNiche(k)] }}
                          >
                            {k.score.toFixed(0)}
                          </span>
                          <span className="rank-score-label">pts</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`star-btn ${starred ? 'is-on' : ''}`}
                        title={starred ? 'Remove shortlist' : 'Add shortlist'}
                        onClick={() => onToggleShortlist(k)}
                      >
                        {starred ? '★' : '☆'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="panel glass panel--legend">
          <div className="panel-title">Legend</div>
          <div className="legend-row">
            <span className="legend-bubble legend-bubble--lg" />
            <span>Size ≈ followers + score</span>
          </div>
          <p className="legend-note legend-note--rank" style={{ marginTop: 6 }}>
            <strong>Viền bubble = rank</strong> — nhìn map tổng thể để phân biệt
            ladder.
          </p>
          <div className="legend-rank-grid" aria-label="Rank ring colors">
            {RANK_ORDER.map((r) => (
              <div key={r} className="legend-rank-item">
                <span
                  className="legend-rank-ring"
                  style={{
                    borderColor: RANK_COLORS[r],
                    boxShadow: `0 0 8px ${RANK_COLORS[r]}55`,
                  }}
                  aria-hidden
                />
                <span style={{ color: RANK_COLORS[r] }}>{RANK_LABELS[r]}</span>
              </div>
            ))}
          </div>
          <div className="legend-status-grid" aria-label="Status emoji">
            {(
              [
                'hot',
                'active',
                'stable',
                'quiet',
                'dormant',
              ] as StatusLabel[]
            ).map((s) => (
              <div key={s} className="legend-status-item">
                <span className="legend-status-emoji">{STATUS_EMOJI[s]}</span>
                <span>{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
          <p className="legend-note legend-note--rank">
            Band 1 → Challenger / Master · Band 2 → Diamond / Plat · Band 3 →
            Gold. Shortlist max 5.
          </p>
        </div>
      </aside>

      <div className="hud-bottom">
        <button type="button" className="btn" onClick={onToggleRotate}>
          {autoRotate ? '⏸ Pause rotate' : '▶ Auto rotate'}
        </button>
        <button type="button" className="btn" onClick={onToggleCompare}>
          {compareOpen ? 'Hide compare' : 'Open shortlist'}
        </button>
        <span className="hint">Drag orbit · scroll zoom · click bubble</span>
      </div>

      {selected && (
        <aside className="hud-detail glass">
          <button
            type="button"
            className="detail-close"
            onClick={() => onSelect(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div
            className="detail-accent"
            style={{ background: NICHE_COLORS[primaryNiche(selected)] }}
          />
          <div className="detail-head">
            <AvatarImg
              handle={selected.handle}
              name={selected.displayName}
              size={52}
              color={NICHE_COLORS[primaryNiche(selected)]}
              className="detail-avatar"
            />
            <div>
              <h2>{selected.displayName}</h2>
              <a
                className="handle"
                href={`https://x.com/${selected.handle}`}
                target="_blank"
                rel="noreferrer"
              >
                @{selected.handle}
              </a>
            </div>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className={`btn ${inShortlist ? 'btn--starred' : ''}`}
              onClick={() => onToggleShortlist(selected)}
            >
              {inShortlist ? '★ In shortlist' : '☆ Add to shortlist'}
            </button>
          </div>

          <div className="detail-tabs" role="tablist" aria-label="Chi tiết KOL">
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'overview'}
              className={`detail-tab ${detailTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setDetailTab('overview')}
            >
              Tổng quan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'analysis'}
              className={`detail-tab ${detailTab === 'analysis' ? 'is-active' : ''}`}
              onClick={() => setDetailTab('analysis')}
            >
              Phân tích chi tiết
            </button>
            {getRecentFollowers(selected.handle).length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === 'follows'}
                className={`detail-tab ${detailTab === 'follows' ? 'is-active' : ''}`}
                onClick={() => setDetailTab('follows')}
              >
                Recent follows
              </button>
            )}
          </div>

          {detailTab === 'overview' && (
            <>
              <p className="detail-bio-label">Hoạt động &amp; assessment (AI)</p>
              <p className="detail-bio detail-bio--assess">{selected.bio}</p>
              <div className="detail-tags">
                <RankBadge
                  tier={selected.tier}
                  score={selected.score}
                  isTop30={selected.isTop30}
                  size="sm"
                  className="tag--rank"
                />
                {selected.isTop30 && (
                  <span className="tag" style={{ color: '#a5b4fc' }}>
                    Top 30 · 7d
                  </span>
                )}
                {selected.statusLabel && (
                  <span
                    className="tag tag--status-emoji"
                    title={STATUS_LABELS[selected.statusLabel]}
                  >
                    {formatStatus(selected.statusLabel)}
                  </span>
                )}
                {selected.verified && (
                  <span className="tag" style={{ color: '#7dd3fc' }}>
                    Verified
                  </span>
                )}
                {getKolNiches(selected).map((n) => (
                  <span
                    key={n}
                    className="tag"
                    style={{
                      color: NICHE_COLORS[n],
                      borderColor: `${NICHE_COLORS[n]}55`,
                    }}
                  >
                    {n}
                  </span>
                ))}
                <span
                  className={`tag ${selected.deltaPct >= 0 ? 'tag--up' : 'tag--down'}`}
                >
                  {selected.deltaPct >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(selected.deltaPct).toFixed(1)}% vs sheet
                </span>
              </div>

              <div className="stat-grid">
                <Stat label="Followers (X)" value={fmt(selected.followers)} />
                <Stat label="Score" value={selected.score.toFixed(1)} />
                <Stat
                  label="7d posts"
                  value={
                    selected.activity7dPosts != null
                      ? `${selected.activity7dPosts}${selected.activity7dSource === 'sampled' ? '*' : '≈'}`
                      : '—'
                  }
                />
                <Stat
                  label="7d likes"
                  value={
                    selected.activity7dLikes != null
                      ? fmt(selected.activity7dLikes)
                      : '—'
                  }
                />
                <Stat
                  label="7d score"
                  value={
                    selected.activity7dScore != null
                      ? selected.activity7dScore.toFixed(0)
                      : '—'
                  }
                />
                <Stat
                  label="Posts/day (life)"
                  value={
                    selected.tweetsPerDay != null
                      ? selected.tweetsPerDay.toFixed(1)
                      : '—'
                  }
                />
              </div>

              <div className="meters">
                <Meter
                  label="Base (audience)"
                  value={selected.baseScore}
                  color={NICHE_COLORS[selected.niche]}
                />
                <Meter
                  label="Hot (pace / 7d blend)"
                  value={selected.hotScore}
                  color="#f472b6"
                />
                {selected.activity7dScore != null && (
                  <Meter
                    label={`7d activity (${selected.activity7dSource ?? '—'})`}
                    value={selected.activity7dScore}
                    color="#a78bfa"
                  />
                )}
                <Meter
                  label="Composite"
                  value={selected.score}
                  color="#e2e8f0"
                />
              </div>
              <p className="detail-source">
                * sampled = X search (may be capped). ≈ estimated lifetime pace ×
                7.
              </p>
            </>
          )}

          {detailTab === 'analysis' && (
            <div className="detail-analysis-tab">
              <SurfAnalysisMock kol={selected} />
              <p className="detail-bio-label" style={{ marginTop: 14 }}>
                Assessment ngắn (map)
              </p>
              <p className="detail-bio detail-bio--assess detail-bio--compact">
                {selected.bio}
              </p>
            </div>
          )}

          {detailTab === 'follows' && (
            <RecentFollowersPanel kolHandle={selected.handle} />
          )}
        </aside>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Meter({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span>{value.toFixed(1)}</span>
      </div>
      <div className="meter-track">
        <div
          className="meter-fill"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}
