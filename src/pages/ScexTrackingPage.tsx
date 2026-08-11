/**
 * Public partner view — SCEX 2D mention matrix + livefeed (VI).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  actorPassesThresholds,
  actorVolumeMetric,
  isMixedSentiment,
  type ScexActor,
  type ScexDataset,
  type ScexPost,
} from '../data/scexTracking'
import { loadScexWithSource } from '../lib/scexStore'
import { loadKolsWithSource } from '../lib/kolStore'
import type { Kol } from '../types'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { DaveysRadarLink } from '../components/DaveysRadarLink'
import { ScexMatrix2D } from '../components/ScexMatrix2D'
import { ScexKolDetail } from '../components/ScexKolDetail'
import { resolveMediaUrl } from '../lib/avatar'
import { applyScexSeo } from '../lib/scexSeo'
import './ScexTrackingPage.css'

const FILTER_KEY = 'scex-matrix-filters-v1'

/** Matrix filter pill ids — multi-select with AND logic */
type MatrixFilterId =
  | 'on_map'
  | 'f_10k'
  | 'f_50k'
  | 'f_100k'
  | 'sent_bullish'
  | 'sent_bearish'
  | 'sent_neutral'
  | 'vol_high'
  | 'qual_high'
  | 'quad_stars'
  | 'quad_nurture'
  | 'quad_noise'
  | 'quad_ignore'

const FOLLOWER_FILTERS: MatrixFilterId[] = ['f_10k', 'f_50k', 'f_100k']
const SENT_FILTERS: MatrixFilterId[] = [
  'sent_bullish',
  'sent_bearish',
  'sent_neutral',
]
const QUAD_FILTERS: MatrixFilterId[] = [
  'quad_stars',
  'quad_nurture',
  'quad_noise',
  'quad_ignore',
]

const MATRIX_FILTER_PILLS: Array<{
  id: MatrixFilterId
  label: string
  title: string
  group?: 'followers' | 'sentiment' | 'quad'
  /** Lite Partner: primary row vs collapsible “Thêm lọc” */
  tier: 'primary' | 'more'
}> = [
  {
    id: 'on_map',
    label: "On Davey's Radar",
    title: "KOL đã có trên Davey's Radar map",
    tier: 'primary',
  },
  {
    id: 'f_10k',
    label: '≥10K FL',
    title: 'Followers ≥ 10.000',
    group: 'followers',
    tier: 'primary',
  },
  {
    id: 'f_50k',
    label: '≥50K FL',
    title: 'Followers ≥ 50.000',
    group: 'followers',
    tier: 'primary',
  },
  {
    id: 'sent_bullish',
    label: 'Tích cực',
    title: 'Sentiment bullish',
    group: 'sentiment',
    tier: 'primary',
  },
  {
    id: 'sent_bearish',
    label: 'Tiêu cực',
    title: 'Sentiment bearish',
    group: 'sentiment',
    tier: 'primary',
  },
  {
    id: 'quad_stars',
    label: 'Ưu tiên',
    title: 'Vùng Ưu tiên hợp tác (hay mention + chất lượng cao)',
    group: 'quad',
    tier: 'primary',
  },
  {
    id: 'quad_nurture',
    label: 'Có tiềm năng',
    title: 'Vùng Có tiềm năng (chất lượng cao · ít mention)',
    group: 'quad',
    tier: 'primary',
  },
  {
    id: 'f_100k',
    label: '≥100K FL',
    title: 'Followers ≥ 100.000',
    group: 'followers',
    tier: 'more',
  },
  {
    id: 'sent_neutral',
    label: 'Trung lập',
    title: 'Neutral / hỗn hợp',
    group: 'sentiment',
    tier: 'more',
  },
  {
    id: 'vol_high',
    label: 'Tần suất cao',
    title: 'Volume score ≥ split (trục X)',
    tier: 'more',
  },
  {
    id: 'qual_high',
    label: 'Chất lượng cao',
    title: 'Quality score ≥ split (trục Y)',
    tier: 'more',
  },
  {
    id: 'quad_noise',
    label: 'Rà soát',
    title: 'Vùng Cần rà soát (hay mention · chất lượng thấp)',
    group: 'quad',
    tier: 'more',
  },
  {
    id: 'quad_ignore',
    label: 'Ít ưu tiên',
    title: 'Vùng Ít ưu tiên (ít mention · chất lượng thấp)',
    group: 'quad',
    tier: 'more',
  },
]

const PRIMARY_FILTER_PILLS = MATRIX_FILTER_PILLS.filter((p) => p.tier === 'primary')
const MORE_FILTER_PILLS = MATRIX_FILTER_PILLS.filter((p) => p.tier === 'more')

function readFilters(): Set<MatrixFilterId> {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.filter((x): x is MatrixFilterId =>
        MATRIX_FILTER_PILLS.some((p) => p.id === x),
      ),
    )
  } catch {
    return new Set()
  }
}

function actorMatchesFilters(
  a: ScexActor,
  filters: Set<MatrixFilterId>,
  mapHandles: Set<string>,
  volumeSplit: number,
  qualitySplit: number,
  config: ScexDataset['config'],
): boolean {
  if (!filters.size) return true
  const h = a.handle.toLowerCase()
  const vol = actorVolumeMetric(a, config)
  const onMap = mapHandles.has(h)

  for (const f of filters) {
    switch (f) {
      case 'on_map':
        if (!onMap) return false
        break
      case 'f_10k':
        if (a.followers < 10_000) return false
        break
      case 'f_50k':
        if (a.followers < 50_000) return false
        break
      case 'f_100k':
        if (a.followers < 100_000) return false
        break
      case 'sent_bullish':
        if (a.sentiment !== 'bullish') return false
        break
      case 'sent_bearish':
        if (a.sentiment !== 'bearish') return false
        break
      case 'sent_neutral':
        if (a.sentiment !== 'neutral' && !isMixedSentiment(a)) return false
        break
      case 'vol_high':
        if (vol < volumeSplit) return false
        break
      case 'qual_high':
        if (a.qualityScore < qualitySplit) return false
        break
      case 'quad_stars':
        if (a.quadrant !== 'stars') return false
        break
      case 'quad_nurture':
        if (a.quadrant !== 'nurture') return false
        break
      case 'quad_noise':
        if (a.quadrant !== 'noise') return false
        break
      case 'quad_ignore':
        if (a.quadrant !== 'ignore') return false
        break
      default:
        break
    }
  }
  return true
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
    return d.toLocaleString('vi-VN', {
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
  const [mapKols, setMapKols] = useState<Kol[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedActor, setSelectedActor] = useState<ScexActor | null>(null)
  /** Livefeed filter: null = all, or lowercase handle */
  const [feedFilter, setFeedFilter] = useState<string | null>(null)
  const [feedQuery, setFeedQuery] = useState('')
  const [matrixFilters, setMatrixFilters] = useState<Set<MatrixFilterId>>(
    () => readFilters(),
  )
  const [matrixFullscreen, setMatrixFullscreen] = useState(false)
  /** Live feed research mode — full viewport timeline */
  const [feedFullscreen, setFeedFullscreen] = useState(false)
  const [feedSort, setFeedSort] = useState<'newest' | 'oldest' | 'engage'>(
    'newest',
  )
  const [feedSentiment, setFeedSentiment] = useState<
    'all' | 'bullish' | 'neutral' | 'bearish'
  >('all')
  const [feedDays, setFeedDays] = useState<0 | 7 | 14 | 30>(0)
  const [feedMediaOnly, setFeedMediaOnly] = useState(false)
  const [feedOnMapOnly, setFeedOnMapOnly] = useState(false)
  const [feedExpandAll, setFeedExpandAll] = useState(false)
  /** Lite Partner: collapse advanced matrix filters (open if any “more” filter already active) */
  const [showMoreFilters, setShowMoreFilters] = useState(() => {
    const saved = readFilters()
    return MORE_FILTER_PILLS.some((p) => saved.has(p.id))
  })

  const openFeedFullscreen = useCallback(() => {
    setMatrixFullscreen(false)
    setFeedFullscreen(true)
  }, [])

  const closeFeedFullscreen = useCallback(() => {
    setFeedFullscreen(false)
  }, [])

  useEffect(() => {
    applyScexSeo()
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadScexWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
    })
    void loadKolsWithSource().then((r) => {
      if (cancelled) return
      setMapKols(r.kols || [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Matrix / feed fullscreen: lock body scroll; Esc closes topmost layer
  useEffect(() => {
    if (!matrixFullscreen && !feedFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Modal detail has its own Esc; panel mode clears selection here first
      if (selectedActor) {
        if (feedFullscreen) {
          e.preventDefault()
          e.stopPropagation()
          setSelectedActor(null)
        }
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (feedFullscreen) {
        setFeedFullscreen(false)
        return
      }
      setMatrixFullscreen(false)
    }
    window.addEventListener('keydown', onKey, true)
    // Force a resize so 2D plot ResizeObserver remeasures after flex settles
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 80)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(t)
    }
  }, [matrixFullscreen, feedFullscreen, selectedActor])

  // Keep detail panel below event banner (avoid overlap)
  useEffect(() => {
    const el = document.querySelector('.scex-event-banner')
    const apply = () => {
      const h = el?.getBoundingClientRect().height ?? 0
      document.documentElement.style.setProperty(
        '--scex-banner-h',
        `${Math.max(0, Math.round(h))}px`,
      )
    }
    apply()
    const ro =
      el && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(apply)
        : null
    if (el && ro) ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [])

  const toggleMatrixFilter = (id: MatrixFilterId) => {
    setMatrixFilters((prev) => {
      const next = new Set(prev)
      const pill = MATRIX_FILTER_PILLS.find((p) => p.id === id)
      if (next.has(id)) {
        next.delete(id)
      } else {
        // Exclusive within followers / sentiment / quadrant groups
        if (pill?.group === 'followers') {
          FOLLOWER_FILTERS.forEach((f) => next.delete(f))
        }
        if (pill?.group === 'sentiment') {
          SENT_FILTERS.forEach((f) => next.delete(f))
        }
        if (pill?.group === 'quad') {
          QUAD_FILTERS.forEach((f) => next.delete(f))
        }
        next.add(id)
      }
      try {
        localStorage.setItem(FILTER_KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const clearMatrixFilters = () => {
    setMatrixFilters(new Set())
    try {
      localStorage.removeItem(FILTER_KEY)
    } catch {
      /* ignore */
    }
  }

  const mapByHandle = useMemo(() => {
    const m = new Map<string, Kol>()
    for (const k of mapKols) {
      m.set(k.handle.replace(/^@/, '').toLowerCase(), k)
    }
    return m
  }, [mapKols])

  const mapHandles = useMemo(
    () => new Set(mapByHandle.keys()),
    [mapByHandle],
  )

  const baseVisible = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    return dataset.actors.filter((a) =>
      actorPassesThresholds(a, dataset.config),
    )
  }, [dataset])

  const visible = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    return baseVisible.filter((a) =>
      actorMatchesFilters(
        a,
        matrixFilters,
        mapHandles,
        dataset.config.volumeSplit,
        dataset.config.qualitySplit,
        dataset.config,
      ),
    )
  }, [dataset, baseVisible, matrixFilters, mapHandles])

  const onMapCount = useMemo(
    () => visible.filter((a) => mapHandles.has(a.handle.toLowerCase())).length,
    [visible, mapHandles],
  )

  const allPosts = useMemo(() => {
    if (!dataset) return [] as ScexPost[]
    return dataset.posts.filter((p) => !p.hidden)
  }, [dataset])

  /** Handles that actually have feed posts (for filter chips) */
  const feedKolOptions = useMemo(() => {
    if (!dataset) return [] as ScexActor[]
    const counts = new Map<string, number>()
    for (const p of allPosts) {
      const h = p.handle.toLowerCase()
      counts.set(h, (counts.get(h) || 0) + 1)
    }
    return dataset.actors
      .filter((a) => counts.has(a.handle.toLowerCase()))
      .sort((a, b) => {
        const ca = counts.get(a.handle.toLowerCase()) || 0
        const cb = counts.get(b.handle.toLowerCase()) || 0
        if (cb !== ca) return cb - ca
        return b.followers - a.followers
      })
  }, [dataset, allPosts])

  const filteredPosts = useMemo(() => {
    let list = allPosts
    if (feedFilter) {
      list = list.filter((p) => p.handle.toLowerCase() === feedFilter)
    }
    const q = feedQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.handle.toLowerCase().includes(q) ||
          p.text.toLowerCase().includes(q) ||
          (dataset?.actors.find((a) => a.handle === p.handle)?.displayName || '')
            .toLowerCase()
            .includes(q),
      )
    }
    if (feedSentiment !== 'all') {
      if (feedSentiment === 'bearish') {
        list = list.filter(
          (p) => p.sentiment === 'bearish' || p.sentiment === 'scam',
        )
      } else if (feedSentiment === 'bullish') {
        list = list.filter((p) => p.sentiment === 'bullish')
      } else {
        list = list.filter(
          (p) => p.sentiment === 'neutral' || p.sentiment === 'shill',
        )
      }
    }
    if (feedDays > 0) {
      const cut = Date.now() - feedDays * 86400000
      list = list.filter((p) => {
        const t = new Date(p.postedAt).getTime()
        return !Number.isNaN(t) && t >= cut
      })
    }
    if (feedMediaOnly) {
      list = list.filter((p) => (p.media?.length || 0) > 0)
    }
    if (feedOnMapOnly) {
      list = list.filter((p) => mapHandles.has(p.handle.toLowerCase()))
    }

    const eng = (p: ScexPost) =>
      (Number(p.likes) || 0) +
      (Number(p.reposts) || 0) * 2 +
      (Number(p.replies) || 0) +
      Math.log10((Number(p.views) || 0) + 1) * 3

    list = [...list].sort((a, b) => {
      if (feedSort === 'engage') return eng(b) - eng(a)
      const ta = new Date(a.postedAt).getTime() || 0
      const tb = new Date(b.postedAt).getTime() || 0
      return feedSort === 'oldest' ? ta - tb : tb - ta
    })

    // Compact side panel: cap; research fullscreen: full timeline
    if (!feedFullscreen) return list.slice(0, 80)
    return list
  }, [
    allPosts,
    feedFilter,
    feedQuery,
    dataset?.actors,
    feedSentiment,
    feedDays,
    feedMediaOnly,
    feedOnMapOnly,
    feedSort,
    feedFullscreen,
    mapHandles,
  ])

  const feedResearchStats = useMemo(() => {
    const bySent = { bullish: 0, neutral: 0, bearish: 0 }
    const handles = new Set<string>()
    let withMedia = 0
    let onMap = 0
    for (const p of filteredPosts) {
      handles.add(p.handle.toLowerCase())
      if (p.sentiment === 'bullish') bySent.bullish++
      else if (p.sentiment === 'bearish' || p.sentiment === 'scam')
        bySent.bearish++
      else bySent.neutral++
      if ((p.media?.length || 0) > 0) withMedia++
      if (mapHandles.has(p.handle.toLowerCase())) onMap++
    }
    return {
      total: filteredPosts.length,
      kols: handles.size,
      bySent,
      withMedia,
      onMap,
    }
  }, [filteredPosts, mapHandles])

  /** Day buckets for research timeline (newest-first day groups) */
  const feedDayGroups = useMemo(() => {
    if (!feedFullscreen) return null as null | Array<{ day: string; posts: ScexPost[] }>
    const map = new Map<string, ScexPost[]>()
    for (const p of filteredPosts) {
      const d = new Date(p.postedAt)
      const key = Number.isNaN(d.getTime())
        ? 'Không rõ ngày'
        : d.toLocaleDateString('vi-VN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()].map(([day, posts]) => ({ day, posts }))
  }, [feedFullscreen, filteredPosts])

  const exportFeedResearch = useCallback(() => {
    const lines = filteredPosts.map((p, i) => {
      const when = p.postedAt?.slice(0, 16) || ''
      const text = (p.text || '').replace(/\s+/g, ' ').trim()
      return `${i + 1}. ${when} @${p.handle} [${p.sentiment}] ${text}${p.url ? ` ${p.url}` : ''}`
    })
    const blob = new Blob(
      [
        `SCEX Live Feed export · ${new Date().toISOString()}\n`,
        `Posts: ${filteredPosts.length} · KOLs: ${feedResearchStats.kols}\n`,
        `Filter: sort=${feedSort} sent=${feedSentiment} days=${feedDays || 'all'} media=${feedMediaOnly} onMap=${feedOnMapOnly} handle=${feedFilter || 'all'} q=${feedQuery || '-'}\n\n`,
        lines.join('\n\n'),
      ],
      { type: 'text/plain;charset=utf-8' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scex-feed-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [
    filteredPosts,
    feedResearchStats.kols,
    feedSort,
    feedSentiment,
    feedDays,
    feedMediaOnly,
    feedOnMapOnly,
    feedFilter,
    feedQuery,
  ])

  /** Matrix select opens detail only — do not auto-filter livefeed (Lite Partner) */
  const onSelectActor = (actor: ScexActor | null) => {
    setSelectedActor(actor)
  }

  const moreFiltersActiveCount = useMemo(() => {
    let n = 0
    for (const p of MORE_FILTER_PILLS) {
      if (matrixFilters.has(p.id)) n++
    }
    return n
  }, [matrixFilters])

  if (!dataset) {
    return (
      <div className="scex-loading">
        <p>Đang tải…</p>
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
            Tracking đang tạm tắt.
          </p>
        </div>
      </div>
    )
  }

  const totalFollowers = visible.reduce((s, a) => s + (a.followers || 0), 0)
  const handle = config.brandHandle?.replace(/^@/, '') || 'scexofficial'
  const selectedMapKol = selectedActor
    ? mapByHandle.get(selectedActor.handle.toLowerCase()) || null
    : null
  const selectedHandleLc = selectedActor?.handle.toLowerCase() ?? null
  const selectedFeedCount = selectedHandleLc
    ? allPosts.filter((p) => p.handle.toLowerCase() === selectedHandleLc).length
    : 0

  const renderFilterPill = (pill: (typeof MATRIX_FILTER_PILLS)[number]) => {
    const active = matrixFilters.has(pill.id)
    const count = baseVisible.filter((a) =>
      actorMatchesFilters(
        a,
        new Set([pill.id]),
        mapHandles,
        config.volumeSplit,
        config.qualitySplit,
        config,
      ),
    ).length
    return (
      <button
        key={pill.id}
        type="button"
        className={`scex-matrix-pill scex-matrix-pill--${pill.id} ${active ? 'is-active' : ''}`}
        title={pill.title}
        onClick={() => toggleMatrixFilter(pill.id)}
        aria-pressed={active}
      >
        {pill.label}
        <span className="scex-matrix-pill__n">{count}</span>
      </button>
    )
  }

  return (
    <div className="scex-page">
      <header className="scex-page__hero scex-page__hero--lite">
        <div className="scex-page__brand">
          <div className="scex-page__logo">
            <XProfileAvatar
              handle={handle}
              name={config.brandName}
              size={48}
              liveFallback
            />
          </div>
          <div className="scex-page__brand-text">
            <div className="scex-page__eyebrow">
              <span className="scex-page__window">
                {config.timeWindowDays} ngày gần đây
              </span>
              <span className="scex-page__socials" aria-label="Kênh SCEX">
                <a
                  className="scex-page__social"
                  href={`https://x.com/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`X · @${handle}`}
                  aria-label={`SCEX trên X (@${handle})`}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
                    />
                  </svg>
                </a>
                <a
                  className="scex-page__social"
                  href="https://www.facebook.com/scexofficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook · SCEX"
                  aria-label="SCEX trên Facebook"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M13.5 22v-8h2.7l.4-3.1h-3.1V9c0-.9.3-1.5 1.6-1.5H16.7V4.7c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.5V14h2.5v8h3.5z"
                    />
                  </svg>
                </a>
                <a
                  className="scex-page__social"
                  href="https://t.me/scexofficial_chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Telegram · SCEX"
                  aria-label="SCEX trên Telegram"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
                    />
                  </svg>
                </a>
              </span>
            </div>
            <h1 className="scex-page__title">
              {config.brandName}
              <span className="scex-page__legal">
                {' '}
                (Công ty Cổ phần Sàn Giao dịch Tài sản Mã hóa Sacom)
              </span>
            </h1>
          </div>
        </div>
        <div className="scex-page__stats">
          <div className="scex-stat">
            <em>
              {visible.length}
              {matrixFilters.size ? `/${baseVisible.length}` : ''}
            </em>
            <span>KOL</span>
          </div>
          <div className="scex-stat">
            <em>{allPosts.length}</em>
            <span>Mention</span>
          </div>
          <div className="scex-stat scex-stat--accent">
            <em>{onMapCount}</em>
            <span>
              On <DaveysRadarLink />
            </span>
          </div>
          <div className="scex-stat scex-stat--muted">
            <em>{formatCompact(totalFollowers)}</em>
            <span>Reach</span>
          </div>
        </div>
      </header>

      <div className="scex-page__grid">
        <section
          className={`scex-card scex-matrix ${matrixFullscreen ? 'is-fullscreen' : ''}`}
          aria-label="Ma trận SCEX"
        >
          <div className="scex-card__head">
            <div>
              <h2>Ma trận SCEX</h2>
              <p className="scex-card__sub">Bấm avatar để xem chi tiết</p>
            </div>
            <div className="scex-matrix__toolbar">
              <button
                type="button"
                className={`scex-fs-btn ${matrixFullscreen ? 'is-on' : ''}`}
                title={
                  matrixFullscreen
                    ? 'Thoát fullscreen (Esc)'
                    : 'Xem ma trận full màn hình'
                }
                aria-pressed={matrixFullscreen}
                onClick={() => {
                  if (matrixFullscreen) setMatrixFullscreen(false)
                  else {
                    setFeedFullscreen(false)
                    setMatrixFullscreen(true)
                  }
                }}
              >
                {matrixFullscreen ? 'Thoát · Esc' : 'Toàn màn hình'}
              </button>
            </div>
          </div>

          <div className="scex-matrix__filters" role="toolbar" aria-label="Lọc ma trận KOL">
            <button
              type="button"
              className={`scex-matrix-pill ${matrixFilters.size === 0 ? 'is-active' : ''}`}
              onClick={clearMatrixFilters}
              title="Hiện tất cả KOL"
            >
              Tất cả
              <span className="scex-matrix-pill__n">{baseVisible.length}</span>
            </button>
            {PRIMARY_FILTER_PILLS.map(renderFilterPill)}
            <button
              type="button"
              className={`scex-matrix-pill scex-matrix-pill--more ${showMoreFilters || moreFiltersActiveCount ? 'is-open' : ''} ${moreFiltersActiveCount ? 'is-active' : ''}`}
              onClick={() => setShowMoreFilters((v) => !v)}
              aria-expanded={showMoreFilters}
              title="Bộ lọc nâng cao"
            >
              {showMoreFilters ? 'Thu gọn' : 'Thêm lọc'}
              {moreFiltersActiveCount > 0 && (
                <span className="scex-matrix-pill__n">{moreFiltersActiveCount}</span>
              )}
            </button>
            {showMoreFilters && MORE_FILTER_PILLS.map(renderFilterPill)}
            {matrixFilters.size > 0 && (
              <button
                type="button"
                className="scex-matrix-pill scex-matrix-pill--clear"
                onClick={clearMatrixFilters}
                title="Xóa mọi bộ lọc"
              >
                Xóa lọc ×
              </button>
            )}
          </div>
          <div
            className={`scex-matrix__body scex-matrix__body--2d ${matrixFullscreen ? 'is-fs' : ''}`}
          >
            <ScexMatrix2D
              actors={visible}
              config={config}
              selectedId={selectedActor?.id ?? null}
              mapHandles={mapHandles}
              onSelect={onSelectActor}
              showZoomControls={matrixFullscreen}
            />
          </div>
        </section>

        <section
          className={`scex-card scex-feed ${feedFullscreen ? 'is-fullscreen' : ''}`}
          aria-label="SCEX Live Feed"
        >
          <div className="scex-card__head">
            <div>
              <h2>SCEX Live Feed</h2>
              <p>
                {filteredPosts.length}
                {feedFilter ||
                feedQuery ||
                feedSentiment !== 'all' ||
                feedDays > 0 ||
                feedMediaOnly ||
                feedOnMapOnly
                  ? ` / ${allPosts.length}`
                  : ''}{' '}
                bài
                {feedFilter ? ` · @${feedFilter}` : ''}
                {feedFullscreen ? ' · nghiên cứu' : ''}
              </p>
            </div>
            <div className="scex-feed__head-actions">
              {selectedActor && (
                <div className="scex-feed__viewing" role="status">
                  <span className="scex-feed__viewing-label">Đang xem</span>
                  <button
                    type="button"
                    className="scex-feed__viewing-chip"
                    onClick={() => onSelectActor(selectedActor)}
                    title="Mở lại panel chi tiết"
                  >
                    <XProfileAvatar
                      handle={selectedActor.handle}
                      name={selectedActor.displayName}
                      size={20}
                    />
                    @{selectedActor.handle}
                  </button>
                  {selectedFeedCount > 0 &&
                    feedFilter !== selectedHandleLc && (
                      <button
                        type="button"
                        className="scex-feed__viewing-action"
                        onClick={() => setFeedFilter(selectedHandleLc)}
                        title="Lọc bảng tin theo KOL này"
                      >
                        Lọc feed ({selectedFeedCount})
                      </button>
                    )}
                  <button
                    type="button"
                    className="scex-feed__viewing-close"
                    onClick={() => setSelectedActor(null)}
                    title="Bỏ chọn"
                    aria-label="Bỏ chọn KOL"
                  >
                    ×
                  </button>
                </div>
              )}
              <button
                type="button"
                className={`scex-fs-btn ${feedFullscreen ? 'is-on' : ''}`}
                title={
                  feedFullscreen
                    ? 'Thoát fullscreen (Esc)'
                    : 'Xem tất cả — timeline toàn màn hình'
                }
                aria-pressed={feedFullscreen}
                onClick={() =>
                  feedFullscreen ? closeFeedFullscreen() : openFeedFullscreen()
                }
              >
                {feedFullscreen ? 'Thoát · Esc' : 'Xem tất cả'}
              </button>
            </div>
          </div>

          <div className="scex-feed__filters">
            <div className="scex-feed__filter-row">
              <button
                type="button"
                className={`scex-feed__chip ${!feedFilter ? 'is-active' : ''}`}
                onClick={() => setFeedFilter(null)}
              >
                Tất cả KOL
              </button>
              {feedFilter && (
                <button
                  type="button"
                  className="scex-feed__chip is-active is-clear"
                  onClick={() => setFeedFilter(null)}
                  title="Bỏ lọc"
                >
                  @{feedFilter} ×
                </button>
              )}
              <input
                className="scex-feed__search"
                type="search"
                placeholder="Tìm handle / nội dung…"
                value={feedQuery}
                onChange={(e) => setFeedQuery(e.target.value)}
                aria-label="Tìm trong livefeed"
              />
            </div>
            <div className="scex-feed__kol-scroll" role="listbox" aria-label="Lọc theo KOL">
              {feedKolOptions.map((a) => {
                const h = a.handle.toLowerCase()
                const n = allPosts.filter((p) => p.handle.toLowerCase() === h)
                  .length
                const active = feedFilter === h
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`scex-feed__kol-chip ${active ? 'is-active' : ''}`}
                    onClick={() =>
                      setFeedFilter((prev) => (prev === h ? null : h))
                    }
                    title={`@${a.handle} · ${n} bài · ${a.followers.toLocaleString()} followers`}
                  >
                    <XProfileAvatar
                      handle={a.handle}
                      name={a.displayName}
                      size={22}
                    />
                    <span className="scex-feed__kol-chip-name">
                      {a.displayName}
                    </span>
                    <span className="scex-feed__kol-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>

            {feedFullscreen && (
              <div className="scex-feed__research" aria-label="Bộ lọc nghiên cứu">
                <div className="scex-feed__research-stats" role="status">
                  <span>
                    <em>{feedResearchStats.total}</em> bài
                  </span>
                  <span>
                    <em>{feedResearchStats.kols}</em> KOL
                  </span>
                  <span className="is-bull">
                    +{feedResearchStats.bySent.bullish}
                  </span>
                  <span className="is-neu">
                    ~{feedResearchStats.bySent.neutral}
                  </span>
                  <span className="is-bear">
                    −{feedResearchStats.bySent.bearish}
                  </span>
                  <span>
                    <em>{feedResearchStats.onMap}</em> On Radar
                  </span>
                  <span>
                    <em>{feedResearchStats.withMedia}</em> media
                  </span>
                </div>
                <div className="scex-feed__research-row">
                  <span className="scex-feed__research-label">Tone</span>
                  {(
                    [
                      ['all', 'Tất cả'],
                      ['bullish', 'Tích cực'],
                      ['neutral', 'Trung lập'],
                      ['bearish', 'Tiêu cực'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`scex-feed__chip ${feedSentiment === id ? 'is-active' : ''} scex-feed__chip--${id}`}
                      onClick={() => setFeedSentiment(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="scex-feed__research-row">
                  <span className="scex-feed__research-label">Thời gian</span>
                  {(
                    [
                      [0, 'Toàn bộ'],
                      [7, '7 ngày'],
                      [14, '14 ngày'],
                      [30, '30 ngày'],
                    ] as const
                  ).map(([d, label]) => (
                    <button
                      key={d}
                      type="button"
                      className={`scex-feed__chip ${feedDays === d ? 'is-active' : ''}`}
                      onClick={() => setFeedDays(d)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="scex-feed__research-row">
                  <span className="scex-feed__research-label">Sắp xếp</span>
                  {(
                    [
                      ['newest', 'Mới nhất'],
                      ['oldest', 'Cũ nhất'],
                      ['engage', 'Tương tác'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`scex-feed__chip ${feedSort === id ? 'is-active' : ''}`}
                      onClick={() => setFeedSort(id)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`scex-feed__chip ${feedMediaOnly ? 'is-active' : ''}`}
                    onClick={() => setFeedMediaOnly((v) => !v)}
                  >
                    Có media
                  </button>
                  <button
                    type="button"
                    className={`scex-feed__chip ${feedOnMapOnly ? 'is-active' : ''}`}
                    onClick={() => setFeedOnMapOnly((v) => !v)}
                  >
                    On Radar
                  </button>
                  <button
                    type="button"
                    className={`scex-feed__chip ${feedExpandAll ? 'is-active' : ''}`}
                    onClick={() => setFeedExpandAll((v) => !v)}
                  >
                    {feedExpandAll ? 'Thu gọn text' : 'Mở rộng text'}
                  </button>
                  <button
                    type="button"
                    className="scex-feed__chip scex-feed__chip--export"
                    onClick={exportFeedResearch}
                    title="Tải file .txt các bài đang lọc"
                  >
                    Export .txt
                  </button>
                </div>
              </div>
            )}
          </div>

          {feedFullscreen && feedDayGroups ? (
            <div className="scex-feed__fs-body">
              <div className="scex-feed__fs-main">
                <div className="scex-feed__timeline">
                  {feedDayGroups.map((g) => (
                    <section key={g.day} className="scex-feed__day">
                      <header className="scex-feed__day-head">
                        <h3>{g.day}</h3>
                        <span>{g.posts.length} bài</span>
                      </header>
                      <ul className="scex-feed__list scex-feed__list--research">
                        {g.posts.map((p, index) => (
                          <ScexFeedCard
                            key={p.id}
                            post={p}
                            actor={dataset.actors.find(
                              (a) => a.handle === p.handle,
                            )}
                            sentimentLabel={
                              config.sentimentLabels[p.sentiment]
                            }
                            onMap={mapHandles.has(p.handle.toLowerCase())}
                            expanded={feedExpandAll || !!expanded[p.id]}
                            onToggleExpand={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [p.id]: !prev[p.id],
                              }))
                            }
                            onOpenActor={() => {
                              const a = dataset.actors.find(
                                (x) => x.handle === p.handle,
                              )
                              if (a) onSelectActor(a)
                            }}
                            index={index}
                            fullMedia
                            selected={
                              selectedHandleLc === p.handle.toLowerCase()
                            }
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                  {!feedDayGroups.length && (
                    <div className="scex-empty scex-empty--cta">
                      <strong>Không có bài khớp bộ lọc nghiên cứu</strong>
                      <p>Thử nới tone / thời gian / bỏ “Có media”.</p>
                    </div>
                  )}
                </div>
              </div>
              <aside
                className="scex-feed__fs-side"
                aria-label="Chi tiết KOL"
              >
                {selectedActor ? (
                  <ScexKolDetail
                    actor={selectedActor}
                    mapKol={selectedMapKol}
                    config={config}
                    posts={allPosts.filter(
                      (p) =>
                        p.handle.toLowerCase() ===
                        selectedActor.handle.toLowerCase(),
                    )}
                    onClose={() => setSelectedActor(null)}
                    variant="panel"
                  />
                ) : (
                  <div className="scex-feed__fs-empty">
                    <strong>Chi tiết KOL</strong>
                    <p>
                      Bấm avatar hoặc tên KOL trên timeline bên trái để xem
                      thống kê, tone, On Radar và toàn bộ mention SCEX của
                      họ.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <ul className="scex-feed__list">
              {filteredPosts.map((p, index) => (
                <ScexFeedCard
                  key={p.id}
                  post={p}
                  actor={dataset.actors.find((a) => a.handle === p.handle)}
                  sentimentLabel={config.sentimentLabels[p.sentiment]}
                  onMap={mapHandles.has(p.handle.toLowerCase())}
                  expanded={!!expanded[p.id]}
                  onToggleExpand={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [p.id]: !prev[p.id],
                    }))
                  }
                  onOpenActor={() => {
                    const a = dataset.actors.find(
                      (x) => x.handle === p.handle,
                    )
                    if (a) onSelectActor(a)
                  }}
                  index={index}
                />
              ))}
              {!filteredPosts.length && (
                <li className="scex-empty scex-empty--cta">
                  {feedFilter || feedQuery ? (
                    <>
                      <strong>Không có bài khớp bộ lọc</strong>
                      <p>Thử bỏ lọc KOL hoặc xóa từ khóa tìm kiếm.</p>
                      <div className="scex-empty__actions">
                        {feedFilter && (
                          <button
                            type="button"
                            className="scex-empty__btn"
                            onClick={() => setFeedFilter(null)}
                          >
                            Xem tất cả KOL
                          </button>
                        )}
                        {feedQuery && (
                          <button
                            type="button"
                            className="scex-empty__btn scex-empty__btn--ghost"
                            onClick={() => setFeedQuery('')}
                          >
                            Xóa tìm kiếm
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Chưa có mention trong cửa sổ này</strong>
                      <p>
                        Chọn KOL trên ma trận để xem thống kê, hoặc đợi batch
                        cập nhật tiếp theo.
                      </p>
                    </>
                  )}
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Modal detail only outside feed research (research docks panel on the right) */}
      {selectedActor && !feedFullscreen && (
        <>
          <button
            type="button"
            className="scex-detail-scrim"
            aria-label="Đóng chi tiết"
            onClick={() => setSelectedActor(null)}
          />
          <ScexKolDetail
            actor={selectedActor}
            mapKol={selectedMapKol}
            config={config}
            posts={allPosts.filter(
              (p) =>
                p.handle.toLowerCase() ===
                selectedActor.handle.toLowerCase(),
            )}
            onClose={() => setSelectedActor(null)}
          />
        </>
      )}
    </div>
  )
}

function ScexFeedCard({
  post,
  actor,
  sentimentLabel,
  onMap,
  expanded,
  onToggleExpand,
  onOpenActor,
  index,
  fullMedia = false,
  selected = false,
}: {
  post: ScexPost
  actor?: ScexActor
  sentimentLabel?: { label: string; color: string }
  onMap: boolean
  expanded: boolean
  onToggleExpand: () => void
  onOpenActor: () => void
  index: number
  /** Research fullscreen: show full images (no crop) + all media items */
  fullMedia?: boolean
  /** Highlight card when KOL is shown in research side panel */
  selected?: boolean
}) {
  const media = post.media || []
  const mediaItems = fullMedia ? media : media.slice(0, 1)
  const likes = post.likes
  const replies = post.replies
  const reposts = post.reposts
  const views = post.views
  const text = (post.text || '').trim() || '—'
  const long = text.length > 180
  const displayText =
    long && !expanded ? `${text.slice(0, 170).trim()}…` : text
  const sentColor = sentimentLabel?.color || '#64748b'

  return (
    <li
      className={`scex-feed-card ${fullMedia ? 'scex-feed-card--full-media' : ''} ${selected ? 'is-selected' : ''}`}
      style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
    >
      <div
        className="scex-feed-card__accent"
        style={{ background: sentColor }}
        aria-hidden
      />
      <div className="scex-feed-card__top">
        <button
          type="button"
          className="scex-feed-card__author"
          onClick={onOpenActor}
          title={
            onMap
              ? "Xem chi tiết KOL On Davey's Radar"
              : 'Xem thống kê SCEX'
          }
        >
          <div
            className="scex-feed-card__av"
            style={{ boxShadow: `0 0 0 2px ${sentColor}55` }}
          >
            <XProfileAvatar
              handle={post.handle}
              name={actor?.displayName || post.handle}
              size={42}
            />
          </div>
          <div className="scex-feed-card__meta">
            <div className="scex-feed-card__name">
              <strong>{actor?.displayName || post.handle}</strong>
              {onMap && (
                <span className="scex-pill scex-pill--map">
                  <DaveysRadarLink />
                </span>
              )}
              {actor?.tier && (
                <span className="scex-pill scex-pill--tier">{actor.tier}</span>
              )}
              {actor?.kind === 'kol' && (
                <span className="scex-pill scex-pill--kol">KOL</span>
              )}
              <span
                className="scex-pill scex-pill--sent"
                style={{ background: sentColor }}
              >
                {sentimentLabel?.label || post.sentiment}
              </span>
            </div>
            <span className="scex-feed-card__sub">
              @{post.handle}
              <span className="scex-feed-card__dot">·</span>
              <time dateTime={post.postedAt}>{formatTime(post.postedAt)}</time>
            </span>
          </div>
        </button>
        {post.url && (
          <a
            className="scex-feed-card__open"
            href={post.url}
            target="_blank"
            rel="noreferrer"
            title="Mở trên X"
          >
            ↗
          </a>
        )}
      </div>

      <p className={`scex-feed-card__text ${expanded ? 'is-expanded' : ''}`}>
        {displayText}
      </p>
      {long && (
        <button type="button" className="scex-feed-card__more" onClick={onToggleExpand}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}

      {mediaItems.length > 0 && (
        <div
          className={`scex-feed-media-wrap ${fullMedia ? 'is-full' : ''} ${mediaItems.length > 1 ? 'is-multi' : ''}`}
        >
          {mediaItems.map((src, mi) => (
            <a
              key={`${post.id}-m${mi}`}
              href={post.url || src}
              target="_blank"
              rel="noreferrer"
              className={`scex-feed-media ${fullMedia ? 'is-full' : ''}`}
            >
              <img
                src={resolveMediaUrl(src)}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.currentTarget
                  el.style.display = 'none'
                  const wrap = el.closest(
                    '.scex-feed-media',
                  ) as HTMLElement | null
                  if (wrap) wrap.style.display = 'none'
                }}
              />
            </a>
          ))}
        </div>
      )}

      {(likes != null || replies != null || reposts != null || views != null) && (
        <div className="scex-feed-metrics">
          {likes != null && (
            <span title="Likes">
              <i>♥</i> {formatCompact(likes)}
            </span>
          )}
          {reposts != null && (
            <span title="Reposts">
              <i>↻</i> {formatCompact(reposts)}
            </span>
          )}
          {replies != null && (
            <span title="Replies">
              <i>💬</i> {formatCompact(replies)}
            </span>
          )}
          {views != null && views > 0 && (
            <span title="Views">
              <i>👁</i> {formatCompact(views)}
            </span>
          )}
        </div>
      )}
    </li>
  )
}
