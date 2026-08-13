import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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

  STATUS_EMOJI,
  STATUS_LABELS,
} from '../types'
import { AvatarImg } from './AvatarImg'
import { BioRichText } from './BioRichText'
import { RankBadge } from './RankBadge'
import { SurfAnalysisMock } from './SurfAnalysisMock'
import { RecentFollowersPanel } from './RecentFollowersPanel'
import { hasFollowerTabData } from '../data/recentFollowers'

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
  searchQuery: string
  shortlistIds: string[]
  autoRotate: boolean
  feedOpen: boolean
  compareOpen: boolean
  onFilter: (n: Niche | 'All') => void
  onFilterRank: (r: KolRank | 'All') => void
  onFilterStatus: (s: StatusLabel | 'All') => void
  onSelect: (kol: Kol | null) => void
  onToggleRotate: () => void
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
  searchQuery,
  shortlistIds,
  autoRotate,
  feedOpen,
  compareOpen,
  onFilter,
  onFilterRank,
  onFilterStatus,
  onSelect,
  onToggleRotate,
  onToggleFeed,
  onToggleCompare,
  onToggleShortlist,
}: Props) {
  const hotCount = kols.filter((k) => k.statusLabel === 'hot').length
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const extraFilters =
    (filterStatus !== 'All' ? 1 : 0) + (filterNiche !== 'All' ? 1 : 0)
  const top = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const sorted = [...kols].sort(
      (a, b) =>
        b.score - a.score ||
        b.followers - a.followers ||
        a.handle.localeCompare(b.handle),
    )
    if (!q) return sorted.slice(0, 10)
    return sorted
      .filter(
        (k) =>
          k.displayName.toLowerCase().includes(q) ||
          k.handle.toLowerCase().includes(q) ||
          getKolNiches(k).some((n) => n.toLowerCase().includes(q)) ||
          formatRank(k).toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [kols, searchQuery])
  const inShortlist = selected ? shortlistIds.includes(selected.id) : false
  const [detailTab, setDetailTab] = useState<
    'overview' | 'analysis' | 'follows'
  >('overview')

  useEffect(() => {
    setDetailTab('overview')
  }, [selected?.id])

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  return (
    <>
      <header className="hud-bar glass">
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
                <span className="seg-btn__rank-label">{RANK_LABELS[r]}</span>
              </button>
            ))}
          </div>

          <div className="hud-more" ref={moreRef}>
            <button
              type="button"
              className={`hud-more__btn ${moreOpen || extraFilters ? 'is-on' : ''}`}
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              title="Lọc status và niche"
            >
              Lọc
              {extraFilters > 0 && (
                <span className="hud-more__badge">{extraFilters}</span>
              )}
            </button>
            {moreOpen && (
              <div className="hud-more__panel glass" role="dialog" aria-label="Bộ lọc">
                <div className="hud-more__label">Trạng thái</div>
                <div className="filter-chips filter-chips--inline" title="Status">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip chip--status chip--emoji chip--sm ${filterStatus === s ? 'chip--active' : ''}`}
                      onClick={() => onFilterStatus(s)}
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
                <div className="hud-more__label">Niche</div>
                <div className="filter-chips filter-chips--wrap" title="Niche">
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
                    >
                      {n !== 'All' && <i className="chip-dot" />}
                      {n === 'All' ? 'All' : n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hud-bar__actions" role="toolbar" aria-label="Live tools">
          <div className="hud-actions">
            {hotCount > 0 && (
              <span
                className="hud-action hud-action--hot"
                title={`${hotCount} KOL đang Hot (pace / 7d)`}
              >
                <span className="hud-action__icon" aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2s4 4.2 4 8a4 4 0 1 1-8 0c0-2.4 1.6-4.6 4-8z"
                      fill="currentColor"
                      opacity="0.95"
                    />
                    <path
                      d="M12 14c1.6 0 2.8 1.1 2.8 2.6S13.6 19.2 12 19.2 9.2 18 9.2 16.6 10.4 14 12 14z"
                      fill="currentColor"
                      opacity="0.55"
                    />
                  </svg>
                </span>
                <span className="hud-action__label">Hot</span>
                <span className="hud-action__badge">{hotCount}</span>
              </span>
            )}
            <button
              type="button"
              className={`hud-action hud-action--feed ${feedOpen ? 'is-on' : ''}`}
              onClick={onToggleFeed}
              title="X Feed — bài đăng gần đây"
              aria-pressed={feedOpen}
            >
              <span className="hud-action__icon" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 6h16M4 12h12M4 18h8"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="hud-action__label">Feed</span>
              {feedOpen && <span className="hud-action__live" aria-hidden />}
            </button>
            <button
              type="button"
              className={`hud-action hud-action--list ${compareOpen ? 'is-on' : ''} ${shortlistIds.length > 0 ? 'has-items' : ''}`}
              onClick={onToggleCompare}
              title="Shortlist / so sánh KOL"
              aria-pressed={compareOpen}
            >
              <span className="hud-action__icon" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="hud-action__label">Shortlist</span>
              {shortlistIds.length > 0 && (
                <span className="hud-action__badge">{shortlistIds.length}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <aside className="hud-left">
        <div className="panel glass panel--rank">
          <div className="panel-head">
            <div>
              <div className="panel-title">Top Score</div>
              <div className="panel-sub">
                {searchQuery.trim()
                  ? `${top.length} match · max 30`
                  : `${kols.length} visible · top 10`}
              </div>
            </div>
            <span className="panel-badge">{top.length}</span>
          </div>
          {top.length === 0 ? (
            <div className="rank-empty">
              {searchQuery.trim()
                ? 'Không có KOL khớp tìm kiếm'
                : 'No KOLs match filters'}
            </div>
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
                            avatarUrl={k.avatarUrl}
                            className="rank-avatar"
                          />
                          <RankBadge
                            tier={k.tier}
                            score={k.score}
                            isTop30={k.isTop30}
                            rank={k.rank}
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
          <div className="legend-rank-grid" aria-label="Rank ring patterns">
            {RANK_ORDER.map((r) => (
              <div key={r} className="legend-rank-item">
                <span
                  className={`legend-rank-ring legend-rank-ring--${r}`}
                  style={{
                    borderColor: RANK_COLORS[r],
                    color: RANK_COLORS[r],
                    boxShadow: `0 0 8px ${RANK_COLORS[r]}44`,
                  }}
                  aria-hidden
                />
                <span className="legend-rank-meta">
                  <span style={{ color: RANK_COLORS[r] }}>{RANK_LABELS[r]}</span>
                </span>
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
        </div>
      </aside>

      <div className="hud-bottom">
        <button type="button" className="btn" onClick={onToggleRotate}>
          {autoRotate ? 'Dừng xoay' : 'Xoay map'}
        </button>
        <button type="button" className="btn" onClick={onToggleCompare}>
          {compareOpen ? 'Ẩn shortlist' : 'Shortlist'}
        </button>
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
              avatarUrl={selected.avatarUrl}
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
              Phân tích sâu
            </button>
            {hasFollowerTabData(selected.handle) && (
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === 'follows'}
                className={`detail-tab ${detailTab === 'follows' ? 'is-active' : ''}`}
                onClick={() => setDetailTab('follows')}
              >
                Smart Followers
              </button>
            )}
          </div>

          {detailTab === 'overview' && (
            <>
              <p className="detail-bio-label">Hoạt động &amp; assessment (AI)</p>
              <BioRichText
                text={selected.bio || ''}
                className="detail-bio detail-bio--assess"
              />
              <div className="detail-tags">
                <RankBadge
                  tier={selected.tier}
                  score={selected.score}
                  isTop30={selected.isTop30}
                  rank={selected.rank}
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
