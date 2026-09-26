/**
 * Near-fullscreen KOL panel for SCEX matrix.
 * SCEX tab: stats + feed of this KOL's SCEX mentions.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  extractKolReportSummary,
  type KolReport,
} from '../data/kolReports'
import { loadPublicReportForHandle } from '../lib/kolReportsStore'
import { BioRichText } from './BioRichText'
import { RankBadge } from './RankBadge'
import { SurfAnalysisMock } from './SurfAnalysisMock'
import { SurfAiExperience, preloadSurfDemo } from '../research/SurfAiExperience'
import { DEMO_HANDLE, DEMO_URL } from '../research/demoConfig'
import { navigateArena, readArenaSelection } from '../lib/arenaNavigation'
import { useDialogFocus } from '../lib/useDialogFocus'
import { XProfileAvatar } from './XProfileAvatar'
import { resolveMediaUrl } from '../lib/avatar'
import { arenaQuadrantTitle, arenaSentimentLabel } from '../lib/kolosseumLabels'
import { isSafeImageUrl, safeHref } from '../lib/safeUrl'

/** Minimal Kol for Surf AI when actor is outside the legacy KOL dataset but has a public report. */
function stubKolFromActor(actor: ScexActor): Kol {
  return {
    id: `scex_${actor.handle}`,
    handle: actor.handle,
    displayName: actor.displayName || actor.handle,
    niche: 'Multi',
    smartFollowers: 0,
    followers: actor.followers || 0,
    posts24h: 0,
    likes24h: 0,
    replies24h: 0,
    reposts24h: 0,
    baseScore: actor.qualityScore || 0,
    hotScore: 0,
    score: actor.qualityScore || 0,
    deltaPct: 0,
    bio: '',
    avatarUrl: actor.avatarUrl,
  }
}

type Tab = 'overview' | 'analysis' | 'scex'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
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
  variant = 'modal',
}: {
  actor: ScexActor
  mapKol: Kol | null
  config: ScexConfig
  /** Posts by this actor mentioning SCEX (already filtered) */
  posts: ScexPost[]
  onClose: () => void
  /**
   * modal — fixed overlay (default, matrix / compact feed)
   * panel — docked column or mobile sheet inside Live Feed fullscreen
   */
  variant?: 'modal' | 'panel'
}) {
  const [tab, setCurrentTab] = useState<Tab>(() => { const t = readArenaSelection().tab; return t === 'surfai' ? 'analysis' : t === 'posts' ? 'scex' : 'overview' })
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocus(panelRef, variant === 'modal')
  const setTab = (next: Tab) => { setCurrentTab(next); navigateArena(actor.handle, next === 'analysis' ? 'surfai' : next === 'scex' ? 'posts' : 'overview') }
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [pubReport, setPubReport] = useState<KolReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const sent = config.sentimentLabels[actor.sentiment]
  const isPanel = variant === 'panel'
  const surfKol = mapKol || stubKolFromActor(actor)
  const hasReport = !!pubReport
  const reportSummary = useMemo(
    () => (pubReport ? extractKolReportSummary(pubReport, 560) : ''),
    [pubReport],
  )

  useEffect(() => {
    const sync = () => { const t = readArenaSelection().tab; setCurrentTab(t === 'surfai' ? 'analysis' : t === 'posts' ? 'scex' : 'overview') }
    sync()
    if (__SURF_DEMO_ENABLED__ && actor.handle.toLowerCase() === DEMO_HANDLE) preloadSurfDemo()
    window.addEventListener('popstate', sync)
    setExpanded({})
    setPubReport(null)
    return () => window.removeEventListener('popstate', sync)
  }, [actor.id, actor.handle])

  useEffect(() => {
    let cancelled = false
    setReportLoading(true)
    void loadPublicReportForHandle(actor.handle).then((r) => {
      if (cancelled) return
      setPubReport(r)
      setReportLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [actor.handle])

  useEffect(() => {
    // Panel mode: parent feed research owns Esc stack (clear selection → exit FS)
    if (isPanel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isPanel])

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
      ref={panelRef}
      tabIndex={-1}
      className={`scex-detail glass ${isPanel ? 'scex-detail--panel' : ''}`}
      role={isPanel ? 'region' : 'dialog'}
      aria-modal={isPanel ? undefined : true}
      aria-label={`Details for @${actor.handle}`}
    >
      <button
        type="button"
        className="scex-detail__close"
        onClick={onClose}
        aria-label={isPanel ? 'Deselect KOL' : 'Close'}
        title={isPanel ? 'Deselect' : 'Close'}
      >
        ×
      </button>
      <div className="scex-detail__accent" style={{ background: accent }} />

      <div className="scex-detail__head">
        {mapKol ? (
          <div className="scex-detail__avatar">
            <XProfileAvatar
              handle={mapKol.handle}
              name={mapKol.displayName}
              avatarUrl={mapKol.avatarUrl || actor.avatarUrl}
              size={56}
              liveFallback
            />
          </div>
        ) : (
          <div className="scex-detail__avatar">
            <XProfileAvatar
              handle={actor.handle}
              name={actor.displayName}
              avatarUrl={actor.avatarUrl}
              size={56}
              liveFallback
            />
          </div>
        )}
        <div className="scex-detail__head-text">
          <div className="scex-detail__name-row">
            <h2>{mapKol?.displayName || actor.displayName}</h2>
            <a
              className="scex-detail__x-logo"
              href={`https://x.com/${actor.handle}`}
              target="_blank"
              rel="noreferrer"
              title={`Open @${actor.handle} on X`}
              aria-label={`Open X profile for @${actor.handle}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path
                  fill="currentColor"
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
                />
              </svg>
            </a>
          </div>
          <a
            className="scex-detail__handle"
            href={`https://x.com/${actor.handle}`}
            target="_blank"
            rel="noreferrer"
          >
            @{actor.handle}
          </a>
          <div className="scex-detail__head-badges">
            {actor.quadrant && (
              <span className="scex-detail__badge">
                {arenaQuadrantTitle(actor.quadrant)}
              </span>
            )}
            <span
              className="scex-detail__badge"
              style={{
                color: sent?.color,
                borderColor: `${sent?.color || '#94a3b8'}55`,
              }}
            >
              {arenaSentimentLabel(actor.sentiment)}
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
          <span>Credibility</span>
          <strong>{Math.round(actor.qualityScore)}</strong>
        </div>
        <div>
          <span>Followers</span>
          <strong>{fmt(actor.followers)}</strong>
        </div>
        <div>
          <span>Feed posts</span>
          <strong>{sortedPosts.length}</strong>
        </div>
      </div>

      <div className="scex-detail__tabs" role="tablist" aria-label="KOL profile">
        {([{ id: 'overview', label: 'Overview' }, { id: 'scex', label: 'Posts' }, { id: 'analysis', label: 'SurfAI' }] as const).map((item, index, items) => <button key={item.id} id={'kol-tab-' + item.id} type="button" role="tab" aria-controls={'kol-panel-' + item.id} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} className={'scex-detail__tab ' + (tab === item.id ? 'is-active' : '')} onClick={() => setTab(item.id)} onKeyDown={event => { let next = index; if (event.key === 'ArrowRight') next = (index + 1) % 3; else if (event.key === 'ArrowLeft') next = (index + 2) % 3; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = 2; else return; event.preventDefault(); setTab(items[next].id); document.getElementById('kol-tab-' + items[next].id)?.focus() }}>{item.label}{item.id === 'analysis' && <span className="surf-tab-star">✦</span>}</button>)}
      </div>

      <div className="scex-detail__scroll" role="tabpanel" id={'kol-panel-' + tab} aria-labelledby={'kol-tab-' + tab}>
        {tab === 'scex' && (
          <div className="scex-detail__body">
            <div className="scex-detail__stats">
              <div>
                <span>Original / replies</span>
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
                <span>Profile tier</span>
                <strong>{actor.mapRank || actor.tier || '—'}</strong>
              </div>
              <div>
                <span>Sentiment</span>
                <strong style={{ color: sent?.color }}>
                  {arenaSentimentLabel(actor.sentiment)}
                </strong>
              </div>
            </div>
            {actor.notes && (
              <p className="scex-detail__notes">{actor.notes}</p>
            )}

            <div className="scex-detail__feed-head">
              <h3>SCEX mentions</h3>
              <span>{sortedPosts.length} posts</span>
            </div>

            {sortedPosts.length === 0 ? (
              <p className="scex-detail__feed-empty">
                No SCEX mentions in the current tracking window for @{actor.handle}.
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
                          {arenaSentimentLabel(p.sentiment)}
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
                          {open ? 'Show less' : 'Show more'}
                        </button>
                      )}
                      {media.length > 0 && (
                        <div className="scex-detail__post-media">
                          {media.slice(0, 3).map((m, i) => {
                            const src = resolveMediaUrl(m)
                            if (!isSafeImageUrl(src)) return null
                            const href = safeHref(src)
                            return (
                              <a
                                key={i}
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={src}
                                  alt=""
                                  loading="lazy"
                                />
                              </a>
                            )
                          })}
                        </div>
                      )}
                      <div className="scex-detail__post-foot">
                        <span>
                          {p.likes != null ? `${fmt(p.likes)} likes` : ''}
                          {p.views != null
                            ? ` · ${fmt(p.views)} views`
                            : ''}
                        </span>
                        {safeHref(p.url) && (
                          <a
                            href={safeHref(p.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View on X ↗
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

          </div>
        )}

        {tab === 'overview' && (
          <div className="scex-detail__body">
            {reportLoading && (
              <p className="scex-detail__label">Loading report summary…</p>
            )}

            {hasReport && reportSummary ? (
              <>
                <p className="scex-detail__label">
                  Surf AI report summary
                  {pubReport?.structured?.overallScore != null && (
                    <span className="scex-detail__score-inline">
                      {' '}
                      · {pubReport.structured.overallScore}/100
                    </span>
                  )}
                </p>
                <div className="scex-detail__report-summary">
                  {reportSummary.split(/\n+/).map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <button
                  type="button"
                  className="scex-detail__open-report"
                  onClick={() => setTab('analysis')}
                >
                  Explore the SurfAI report →
                </button>
              </>
            ) : (
              !reportLoading && (
                <>
                  <p className="scex-detail__label">
                    {mapKol
                      ? 'Activity and profile assessment'
                      : 'No public Surf AI report yet'}
                  </p>
                  {mapKol?.bio ? (
                    <BioRichText
                      text={mapKol.bio}
                      className="scex-detail__bio scex-detail__bio--clamp"
                    />
                  ) : (
                    <p className="scex-detail__feed-empty">
                      Explore this KOL’s source posts, or open SurfAI for available research.
                    </p>
                  )}
                </>
              )
            )}

            {mapKol && (
              <>
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
                    <span>Profile score</span>
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
                    <span>SCEX mentions</span>
                    <strong>{actor.postsVolume}</strong>
                  </div>
                </div>
              </>
            )}

            {!mapKol && (
              <div className="scex-detail__stats">
                <div>
                  <span>Followers</span>
                  <strong>{fmt(actor.followers)}</strong>
                </div>
                <div>
                  <span>SCEX credibility</span>
                  <strong>{Math.round(actor.qualityScore)}</strong>
                </div>
                <div>
                  <span>SCEX mentions</span>
                  <strong>{actor.postsVolume}</strong>
                </div>
                <div>
                  <span>Sentiment</span>
                  <strong>{arenaSentimentLabel(actor.sentiment)}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'analysis' && (
          <div className="scex-detail__body scex-detail__body--surf">
            {__SURF_DEMO_ENABLED__ && actor.handle.toLowerCase() === DEMO_HANDLE ? (
              <SurfAiExperience />
            ) : (
              <><SurfAnalysisMock kol={surfKol} />{__SURF_DEMO_ENABLED__ && <a className="premium-demo-link" href={DEMO_URL}>Explore the nbaluong SurfAI demo →</a>}</>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
