import { useMemo, useState } from 'react'
import type { Kol } from '../types'
import {
  formatRank,
  getKolNiches,
  NICHE_COLORS,
  primaryNiche,
} from '../types'
import type { StatusLabel } from '../types'
import { AvatarImg } from './AvatarImg'
import { BioRichText } from './BioRichText'
import { RankBadge } from './RankBadge'
import { StatusBadge } from './StatusBadge'

interface Props {
  open: boolean
  shortlist: Kol[]
  onClose: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onSelect: (kol: Kol) => void
}

const SHORTLIST_MAX = 5

export function ComparePanel({
  open,
  shortlist,
  onClose,
  onRemove,
  onClear,
  onSelect,
}: Props) {
  const [compact, setCompact] = useState(false)
  const [expandedBio, setExpandedBio] = useState<Record<string, boolean>>({})

  const totals = useMemo(() => {
    if (!shortlist.length) {
      return { followers: 0, avgScore: 0, hot: 0 }
    }
    const followers = shortlist.reduce((s, k) => s + (k.followers || 0), 0)
    const avgScore =
      shortlist.reduce((s, k) => s + (k.score || 0), 0) / shortlist.length
    const hot = shortlist.filter((k) => k.statusLabel === 'hot').length
    return { followers, avgScore, hot }
  }, [shortlist])

  if (!open) return null

  const exportJson = () => {
    const payload = shortlist.map(exportRow)
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `vn-kol-shortlist-${dateStamp()}.json`,
      'application/json',
    )
  }

  const exportCsv = () => {
    const rows = shortlist.map(exportRow)
    const headers = Object.keys(rows[0] ?? { handle: '' })
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => csvEscape(String((r as Record<string, unknown>)[h] ?? '')))
          .join(','),
      ),
    ]
    downloadBlob(lines.join('\n'), `vn-kol-shortlist-${dateStamp()}.csv`, 'text/csv')
  }

  const copyText = async () => {
    const text = shortlist
      .map(
        (k, i) =>
          `${i + 1}. @${k.handle} (${k.displayName}) · ${formatRank(k)} · ${k.statusLabel ?? '—'} · ${fmt(k.followers)} foll · score ${k.score.toFixed(0)}${k.activity7dPosts != null ? ` · 7d posts ${k.activity7dPosts}` : ''}`,
      )
      .join('\n')
    try {
      await navigator.clipboard.writeText(text || '(empty)')
    } catch {
      /* ignore */
    }
  }

  return (
    <aside
      className={`compare-panel glass-regular glass--liquid ${compact ? 'compare-panel--compact' : ''}`}
    >
      <header className="feed-head compare-head">
        <div className="feed-head-main">
          <div className="feed-title-row">
            <span className="live-dot live-dot--star" aria-hidden>
              ★
            </span>
            <h2>Shortlist</h2>
            <span className="feed-badge compare-badge">
              {shortlist.length}/{SHORTLIST_MAX}
            </span>
          </div>
          <p className="feed-sub">
            So sánh tối đa {SHORTLIST_MAX} KOL · ☆ trên detail / Top Score
          </p>
        </div>
        <div className="feed-actions">
          <button
            type="button"
            className="icon-btn"
            title={compact ? 'Mở rộng' : 'Thu gọn'}
            onClick={() => setCompact((v) => !v)}
          >
            {compact ? '▣' : '▬'}
          </button>
          <button type="button" className="icon-btn" title="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      {!compact && shortlist.length > 0 && (
        <>
          <div className="feed-stats-bar">
            <div className="feed-stat">
              <em>{shortlist.length}</em>
              <span>selected</span>
            </div>
            <div className="feed-stat">
              <em>{fmt(totals.followers)}</em>
              <span>followers</span>
            </div>
            <div className="feed-stat">
              <em>{totals.avgScore.toFixed(0)}</em>
              <span>avg pts</span>
            </div>
            <div className="feed-stat">
              <em>{totals.hot || '—'}</em>
              <span>hot</span>
            </div>
          </div>

          <div className="feed-toolbar compare-toolbar">
            <div className="compare-actions-row">
              <button type="button" className="btn btn--sm" onClick={exportCsv}>
                CSV
              </button>
              <button type="button" className="btn btn--sm" onClick={exportJson}>
                JSON
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => void copyText()}
              >
                Copy
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={onClear}
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      <div className="feed-list compare-list">
        {shortlist.length === 0 ? (
          <div className="feed-empty">
            <div className="feed-empty__icon">★</div>
            <p>Chưa có KOL trong shortlist</p>
            <span>
              Mở detail → “Add to shortlist”, hoặc ☆ trên Top Score (tối đa{' '}
              {SHORTLIST_MAX}).
            </span>
          </div>
        ) : (
          shortlist.map((k, i) => {
            const st = (k.statusLabel ?? 'stable') as StatusLabel
            const color = NICHE_COLORS[primaryNiche(k)]
            const niches = getKolNiches(k)
            const bio = k.bio || ''
            const long = bio.length > 180
            const openBio = !!expandedBio[k.id]
            const displayBio =
              !openBio && long ? bio.slice(0, 160).trimEnd() + '…' : bio

            return (
              <article
                key={k.id}
                className="feed-card compare-card"
                style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
              >
                <div
                  className="feed-card__accent"
                  style={{ background: color }}
                  aria-hidden
                />

                <div className="feed-card-top">
                  <button
                    type="button"
                    className="feed-author"
                    onClick={() => onSelect(k)}
                  >
                    <div
                      className="feed-av-wrap"
                      style={{ boxShadow: `0 0 0 2px ${color}55` }}
                    >
                      <AvatarImg
                        handle={k.handle}
                        name={k.displayName}
                        size={42}
                        color={color}
                        avatarUrl={k.avatarUrl}
                      />
                    </div>
                    <div className="feed-author-meta">
                      <div className="feed-author-name">
                        <strong>{k.displayName}</strong>
                        {st === 'hot' && <span className="hot-pill">HOT</span>}
                        <span
                          className="niche-pill"
                          style={{ color, borderColor: `${color}55` }}
                        >
                          {niches[0] ?? primaryNiche(k)}
                        </span>
                      </div>
                      <span className="feed-author-sub">
                        @{k.handle}
                        <span className="feed-dot">·</span>
                        #{i + 1} shortlist
                      </span>
                    </div>
                  </button>
                  <div className="feed-card-actions">
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      title="Focus trên map"
                      onClick={() => onSelect(k)}
                    >
                      ◎
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      title="Gỡ shortlist"
                      onClick={() => onRemove(k.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="compare-tags">
                  <RankBadge
                    tier={k.tier}
                    score={k.score}
                    isTop30={k.isTop30}
                    rank={k.rank}
                    size="sm"
                  />
                  <StatusBadge status={st} size="sm" />
                  {niches.length > 1 && (
                    <span
                      className="tag"
                      style={{
                        color,
                        borderColor: `${color}55`,
                      }}
                    >
                      {niches.join(' · ')}
                    </span>
                  )}
                  {k.isTop30 && <span className="tag tag--muted">Top30</span>}
                </div>

                <div className="feed-metrics compare-metrics">
                  <span title="Followers">
                    <i>◎</i> {fmt(k.followers)}
                  </span>
                  <span title="Score">
                    <i>◆</i> {k.score.toFixed(0)}
                  </span>
                  <span title="Hot">
                    <i>↑</i> {k.hotScore.toFixed(0)}
                  </span>
                  <span title="7d posts">
                    <i>7d</i>{' '}
                    {k.activity7dPosts != null
                      ? `${k.activity7dPosts}${k.activity7dSource === 'sampled' ? '*' : '≈'}`
                      : '—'}
                  </span>
                </div>

                {bio && (
                  <>
                    {openBio || !long ? (
                      <BioRichText
                        text={bio}
                        className="feed-text compare-bio-text compare-bio-text--rich"
                      />
                    ) : (
                      <p className="feed-text compare-bio-text">{displayBio}</p>
                    )}
                    {long && (
                      <button
                        type="button"
                        className="feed-more"
                        onClick={() =>
                          setExpandedBio((prev) => ({
                            ...prev,
                            [k.id]: !prev[k.id],
                          }))
                        }
                      >
                        {openBio ? 'Thu gọn' : 'Xem thêm'}
                      </button>
                    )}
                  </>
                )}
              </article>
            )
          })
        )}
      </div>

      {!compact && (
        <footer className="feed-foot">
          <span className="feed-foot__left">
            {shortlist.length > 0 ? (
              <>
                <strong>{shortlist.length}</strong> / {SHORTLIST_MAX} slots
              </>
            ) : (
              'Empty shortlist'
            )}
          </span>
          <span className="feed-foot__right">
            * sampled · ≈ estimated pace×7
          </span>
        </footer>
      )}
    </aside>
  )
}

function exportRow(k: Kol) {
  return {
    handle: k.handle,
    name: k.displayName,
    rank: formatRank(k),
    tier: k.tier ?? '',
    niche: primaryNiche(k),
    niches: getKolNiches(k).join('|'),
    status: k.statusLabel ?? '',
    followers: k.followers,
    score: k.score,
    hotScore: k.hotScore,
    activity7dPosts: k.activity7dPosts ?? '',
    activity7dLikes: k.activity7dLikes ?? '',
    activity7dScore: k.activity7dScore ?? '',
    activity7dSource: k.activity7dSource ?? '',
    tweetsPerDay: k.tweetsPerDay ?? '',
    verified: k.verified ?? false,
    url: `https://x.com/${k.handle}`,
    assessment: k.bio,
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
