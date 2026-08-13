import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Kol, KolRank, Niche, StatusLabel } from '../types'
import {
  formatRank,
  getKolNiches,
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  RANK_COLORS,
  RANK_LABELS,
  RANK_ORDER,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../types'
import { AvatarImg } from './AvatarImg'
import { BioRichText } from './BioRichText'
import { RankBadge } from './RankBadge'
import { StatusBadge } from './StatusBadge'
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [morePos, setMorePos] = useState<{ top: number; left: number } | null>(
    null,
  )
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const morePanelRef = useRef<HTMLDivElement>(null)
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
    const place = () => {
      const r = moreBtnRef.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(460, window.innerWidth * 0.86)
      const left = Math.min(
        Math.max(12, r.left),
        window.innerWidth - width - 12,
      )
      setMorePos({ top: r.bottom + 8, left })
    }
    place()
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (moreBtnRef.current?.contains(t) || morePanelRef.current?.contains(t)) {
        return
      }
      setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
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

          <div className="hud-more">
            <button
              ref={moreBtnRef}
              type="button"
              className={`hud-more__btn ${moreOpen || extraFilters ? 'is-on' : ''}`}
              onClick={() => {
                if (moreOpen) {
                  setMoreOpen(false)
                  return
                }
                const r = moreBtnRef.current?.getBoundingClientRect()
                if (r) {
                  const width = Math.min(460, window.innerWidth * 0.86)
                  setMorePos({
                    top: r.bottom + 8,
                    left: Math.min(
                      Math.max(12, r.left),
                      window.innerWidth - width - 12,
                    ),
                  })
                }
                setMoreOpen(true)
              }}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              title="Lọc status và niche"
            >
              <svg
                className="hud-more__icon"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              Lọc
              {extraFilters > 0 && (
                <span className="hud-more__badge">{extraFilters}</span>
              )}
            </button>
          </div>
        </div>

        <div className="hud-bar__actions" role="toolbar" aria-label="Live tools">
          <div className="hud-actions">
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
          </div>
        </div>
      </header>
      {moreOpen && morePos
        ? createPortal(
            <div
              ref={morePanelRef}
              className="hud-more__panel glass"
              role="dialog"
              aria-label="Bộ lọc"
              style={{ top: morePos.top, left: morePos.left }}
            >
              <div className="hud-more__label">Trạng thái</div>
              <div className="hud-more__status" title="Status">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`seg-btn seg-btn--status ${filterStatus === s ? 'is-active' : ''}`}
                    style={
                      s !== 'All'
                        ? ({
                            ['--rank' as string]: STATUS_COLORS[s],
                          } as CSSProperties)
                        : undefined
                    }
                    onClick={() => onFilterStatus(s)}
                    title={
                      s === 'All'
                        ? 'All statuses'
                        : filterStatus === s
                          ? 'Click again to clear'
                          : `Filter ${STATUS_LABELS[s]}`
                    }
                  >
                    {s === 'All' ? (
                      'All'
                    ) : (
                      <>
                        <StatusBadge
                          status={s}
                          size="pip"
                          className="rank-pip--filter"
                        />
                        <span className="seg-btn__rank-label">
                          {STATUS_LABELS[s]}
                        </span>
                      </>
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
            </div>,
            document.body,
          )
        : null}

      <aside className="hud-left">
        <div className="panel glass glass--liquid panel--rank">
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
                            <StatusBadge
                              status={(k.statusLabel ?? 'stable') as StatusLabel}
                              size="sm"
                            />
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
                  <StatusBadge status={selected.statusLabel} size="sm" />
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
