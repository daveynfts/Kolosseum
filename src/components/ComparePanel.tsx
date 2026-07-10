import type { Kol } from '../types'
import {
  getKolNiches,
  NICHE_COLORS,
  primaryNiche,
  formatStatus,
  STATUS_LABELS,
} from '../types'
import type { StatusLabel } from '../types'
import { AvatarImg } from './AvatarImg'

interface Props {
  open: boolean
  shortlist: Kol[]
  onClose: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onSelect: (kol: Kol) => void
}

export function ComparePanel({
  open,
  shortlist,
  onClose,
  onRemove,
  onClear,
  onSelect,
}: Props) {
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
          `${i + 1}. @${k.handle} (${k.displayName}) · T${k.tier} · ${k.statusLabel ?? '—'} · ${fmt(k.followers)} foll · score ${k.score.toFixed(0)}${k.activity7dPosts != null ? ` · 7d posts ${k.activity7dPosts}` : ''}`,
      )
      .join('\n')
    try {
      await navigator.clipboard.writeText(text || '(empty)')
    } catch {
      /* ignore */
    }
  }

  return (
    <aside className="compare-panel glass">
      <header className="compare-head">
        <div>
          <h2>Shortlist / Compare</h2>
          <p>
            {shortlist.length}/5 selected · click ☆ on detail or rank to add
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="Close">
          ×
        </button>
      </header>

      {shortlist.length === 0 ? (
        <div className="compare-empty">
          <p>Chưa có KOL trong shortlist</p>
          <span>Mở detail panel và bấm “Add to shortlist”, hoặc ☆ trên top list.</span>
        </div>
      ) : (
        <>
          <div className="compare-actions">
            <button type="button" className="btn" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="btn" onClick={exportJson}>
              Export JSON
            </button>
            <button type="button" className="btn" onClick={() => void copyText()}>
              Copy list
            </button>
            <button type="button" className="btn btn--danger" onClick={onClear}>
              Clear
            </button>
          </div>

          <div className="compare-grid">
            {shortlist.map((k) => {
              const st = (k.statusLabel ?? 'stable') as StatusLabel
              return (
                <div key={k.id} className="compare-card">
                  <div className="compare-card-top">
                    <button
                      type="button"
                      className="compare-author"
                      onClick={() => onSelect(k)}
                    >
                      <AvatarImg
                        handle={k.handle}
                        name={k.displayName}
                        size={40}
                        color={NICHE_COLORS[primaryNiche(k)]}
                      />
                      <div>
                        <strong>{k.displayName}</strong>
                        <span>@{k.handle}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      title="Remove"
                      onClick={() => onRemove(k.id)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="compare-tags">
                    <span className="tag tag--tier">T{k.tier}</span>
                    <span className="tag tag--status-emoji" title={STATUS_LABELS[st]}>
                      {formatStatus(st)}
                    </span>
                    <span
                      className="tag"
                      style={{
                        color: NICHE_COLORS[primaryNiche(k)],
                        borderColor: `${NICHE_COLORS[primaryNiche(k)]}55`,
                      }}
                    >
                      {getKolNiches(k).join(' · ')}
                    </span>
                    {k.isTop30 && <span className="tag tag--muted">Top30</span>}
                  </div>
                  <div className="compare-stats">
                    <Row label="Followers" value={fmt(k.followers)} />
                    <Row label="Score" value={k.score.toFixed(1)} />
                    <Row label="Hot" value={k.hotScore.toFixed(1)} />
                    <Row
                      label="7d posts"
                      value={
                        k.activity7dPosts != null
                          ? `${k.activity7dPosts}${k.activity7dSource === 'sampled' ? '*' : '≈'}`
                          : '—'
                      }
                    />
                    <Row
                      label="7d likes"
                      value={
                        k.activity7dLikes != null ? fmt(k.activity7dLikes) : '—'
                      }
                    />
                    <Row
                      label="7d score"
                      value={
                        k.activity7dScore != null
                          ? k.activity7dScore.toFixed(0)
                          : '—'
                      }
                    />
                    <Row
                      label="Posts/day"
                      value={
                        k.tweetsPerDay != null ? k.tweetsPerDay.toFixed(1) : '—'
                      }
                    />
                    <Row
                      label="Δ vs sheet"
                      value={`${k.deltaPct >= 0 ? '+' : ''}${k.deltaPct.toFixed(1)}%`}
                    />
                  </div>
                  <p className="compare-bio">{k.bio}</p>
                </div>
              )
            })}
          </div>
          <p className="compare-note">
            * sampled = X search sample (có thể capped). ≈ = estimated from lifetime
            pace × 7.
          </p>
        </>
      )}
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="compare-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function exportRow(k: Kol) {
  return {
    handle: k.handle,
    name: k.displayName,
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
