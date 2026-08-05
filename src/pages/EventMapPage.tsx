import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type {
  Map as MapLibreMap,
  Marker,
  Popup,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  MAIN_FORUM_SCHEDULE,
  SALA_VENUE,
  buildConflictMap,
  buildDayTimeline,
  calendarStripDates,
  directionsUrl,
  eventDistanceKm,
  eventOccursOnDate,
  isMainEvent,
  isMainVenueSideStage,
  pinDisplayPositions,
  formatDayNum,
  formatDistanceWithDrive,
  formatLumaTime,
  formatShortDate,
  getSideEventStatus,
  mainForumMeta,
  matchesDateFilter,
  shortEventTitle,
  sortEvents,
  sortEventsUpcoming,
  toSquareImageUrl,
  type SideEvent,
  type SideEventDataset,
  type SideEventType,
  type UiLocale,
  eventToIcs,
} from '../data/convictionEvents'
import { loadEventsWithSource } from '../lib/convictionEventsStore'
import {
  formatLumaDayLocale,
  formatMonthYear,
  formatWeekdayShort,
  useEventMapLocale,
  type EventMapLocale,
} from '../lib/eventMapI18n'
import { withBase } from '../lib/base'
import './EventMapPage.css'

const CONVICTION_LOGO = withBase('/conviction/logo-full.svg')
const CONVICTION_HOME = 'https://www.conviction.vn/vi'

/** Raster dark tiles — avoids CARTO vector TileJSON hangs with MapLibre v6. */
/**
 * Dark basemap (Carto).
 * Note: `dark_matter` raster path 404s — use `dark_all` (proven working).
 * UI chrome stays DaveyNFTs #030305; map tiles are near-black OSM labels.
 */
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'Carto Dark All',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-dark',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
}

const HCMC_BOUNDS: [[number, number], [number, number]] = [
  [106.35, 10.35],
  [107.05, 11.05],
]

type SortMode = 'upcoming' | 'nearest' | 'alpha'
type SheetMode = 'peek' | 'half' | 'full'

function todayVn(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function nowHmVn(): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())
  } catch {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

/** Live = same multi-day logic as pin status (handles endDate correctly). */
function isLive(ev: SideEvent, now: Date = new Date()): boolean {
  return getSideEventStatus(ev, now).phase === 'live'
}

/** Parse deep link from hash `#/event?id=&date=` or search. */
function parseEventMapParams(): { id?: string; date?: string } {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const qIdx = hash.indexOf('?')
  const fromHash = qIdx >= 0 ? hash.slice(qIdx + 1) : ''
  const params = new URLSearchParams(fromHash || window.location.search.slice(1))
  const id = params.get('id')?.trim() || undefined
  const date = params.get('date')?.trim() || undefined
  return { id, date }
}

function writeEventMapParams(opts: {
  id?: string | null
  date?: string | null
}) {
  const params = new URLSearchParams()
  if (opts.date && opts.date !== 'all') params.set('date', opts.date)
  if (opts.id) params.set('id', opts.id)
  const q = params.toString()
  const next = q ? `#/event?${q}` : '#/event'
  if (window.location.hash !== next) {
    history.replaceState(null, '', next)
  }
}

function downloadIcs(ev: SideEvent) {
  const blob = new Blob([eventToIcs(ev)], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function popupHtml(
  ev: SideEvent,
  opts: {
    live: boolean
    today: boolean
    distanceLabel?: string
    statusLabel?: string
    statusPhase?: string
    locale: EventMapLocale
    labels: {
      badgeMain: string
      badgeStage: string
      badgeSide: string
      badgeLive: string
      badgeToday: string
      badgeDateTbd: string
      badgeLocTbd: string
      badgeFree: string
      register: string
      directions: string
      host: string
      place: string
      placeTbdLong: string
      pinTempNote: string
      whenTbd: string
    }
  },
): string {
  const L = opts.labels
  const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type
  const timePart = `${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
  const when = ev.dateTbd
    ? L.whenTbd.replace('{time}', timePart)
    : ev.endDate && ev.endDate !== ev.date
      ? `${formatShortDate(ev.date)} ${ev.startTime} → ${formatShortDate(ev.endDate)} ${ev.endTime || ''}`.trim()
      : `${formatShortDate(ev.date)} · ${timePart}`
  const stPhase = opts.statusPhase || (opts.live ? 'live' : 'upcoming')
  const stLabel = opts.statusLabel || (opts.live ? 'LIVE' : '')
  const main = isMainEvent(ev)
  const stage = !main && isMainVenueSideStage(ev)
  const badges = [
    main
      ? `<span class="emp__badge emp__badge--main">${escapeHtml(L.badgeMain)}</span>`
      : stage
        ? `<span class="emp__badge emp__badge--stage">${escapeHtml(L.badgeStage)}</span>`
        : `<span class="emp__badge emp__badge--side">${escapeHtml(L.badgeSide)}</span>`,
    stLabel
      ? `<span class="emp__badge emp__badge--status emp__badge--status-${escapeHtml(stPhase)}">${escapeHtml(stLabel)}</span>`
      : '',
    opts.live
      ? `<span class="emp__badge emp__badge--live">${escapeHtml(L.badgeLive)}</span>`
      : '',
    !opts.live && opts.today && !ev.dateTbd
      ? `<span class="emp__badge emp__badge--today">${escapeHtml(L.badgeToday)}</span>`
      : '',
    ev.dateTbd
      ? `<span class="emp__badge">${escapeHtml(L.badgeDateTbd)}</span>`
      : '',
    ev.locationTbd
      ? `<span class="emp__badge">${escapeHtml(L.badgeLocTbd)}</span>`
      : '',
    ev.free
      ? `<span class="emp__badge emp__badge--free">${escapeHtml(L.badgeFree)}</span>`
      : '',
    `<span class="emp__badge">${typeLabel}</span>`,
  ]
    .filter(Boolean)
    .join(' ')
  const reg = ev.link
    ? `<a class="emp-popup__act emp-popup__act--reg" href="${ev.link}" target="_blank" rel="noopener noreferrer">${escapeHtml(L.register)}</a>`
    : `<span class="emp-popup__act emp-popup__act--disabled">${escapeHtml(L.register)}</span>`
  const directions = ev.locationTbd
    ? `<a class="emp-popup__act emp-popup__act--map" href="${directionsUrl(SALA_VENUE.lat, SALA_VENUE.lng)}" target="_blank" rel="noopener noreferrer">${escapeHtml(L.directions)}</a>`
    : `<a class="emp-popup__act emp-popup__act--map" href="${directionsUrl(ev.lat, ev.lng)}" target="_blank" rel="noopener noreferrer">${escapeHtml(L.directions)}</a>`
  const img = ev.imageUrl
    ? `<img class="emp-popup__img" src="${escapeHtml(toSquareImageUrl(ev.imageUrl, 640))}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
    : ''
  const dist = opts.distanceLabel
    ? `<p class="emp-popup__row emp-popup__dist">${escapeHtml(opts.distanceLabel)}</p>`
    : ''
  const placeLine = ev.locationTbd
    ? L.placeTbdLong
    : [ev.venue, ev.address].filter(Boolean).join(' — ')
  return `
    <div class="emp-popup__inner">
      ${img}
      <div class="emp-popup__body">
        <h3 class="emp-popup__title">${escapeHtml(ev.title)}</h3>
        <div class="emp__badges emp-popup__badges">${badges}</div>
        <p class="emp-popup__row emp-popup__when">${escapeHtml(when)}</p>
        ${dist}
        ${ev.host ? `<p class="emp-popup__row"><span class="emp-popup__k">${escapeHtml(L.host)}</span> ${escapeHtml(ev.host)}</p>` : ''}
        <p class="emp-popup__row"><span class="emp-popup__k">${escapeHtml(L.place)}</span> ${escapeHtml(placeLine)}</p>
        ${
          ev.locationTbd
            ? `<p class="emp-popup__row emp-popup__note">${escapeHtml(L.pinTempNote)}</p>`
            : ''
        }
        ${ev.description ? `<p class="emp-popup__desc">${escapeHtml(ev.description)}</p>` : ''}
        <div class="emp-popup__actions">
          ${directions}
          ${reg}
        </div>
      </div>
    </div>
  `
}

/**
 * Marker DOM for MapLibre.
 * IMPORTANT: never set CSS `transform` on the root element — MapLibre owns
 * that for lat/lng placement. Hover/scale only on an inner wrapper.
 * Status chip sits ABOVE the pin (countdown / LIVE / END).
 */
function buildLumaPinEl(
  ev: SideEvent,
  now: Date = new Date(),
  locale: UiLocale = 'vi',
  tierLabels?: { main: string; stage: string; side: string },
): HTMLDivElement {
  const st = getSideEventStatus(ev, now, locale)
  const main = isMainEvent(ev)
  const stage = !main && isMainVenueSideStage(ev)
  const root = document.createElement('div')
  root.className = [
    'emp-pin',
    main ? 'emp-pin--main' : '',
    stage ? 'emp-pin--stage' : '',
    !main && !stage && ev.featured ? 'emp-pin--featured' : '',
    st.phase === 'live' ? 'emp-pin--live' : '',
    st.phase === 'ended' ? 'emp-pin--ended' : '',
    st.phase === 'upcoming' ? 'emp-pin--upcoming' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const tier = main
    ? tierLabels?.main || 'MAIN'
    : stage
      ? tierLabels?.stage || 'STAGE'
      : tierLabels?.side || 'SIDE'
  root.title = `${tier} · ${ev.title} · ${st.detail}`
  root.dataset.eventId = ev.id
  root.dataset.tier = main ? 'main' : stage ? 'stage' : 'side'
  // Main stays above co-located stage/side pins
  root.style.zIndex = main ? '8' : stage ? '5' : '3'

  const visual = document.createElement('div')
  visual.className = 'emp-pin__visual'

  // Status floating above pin head
  const status = document.createElement('div')
  status.className = `emp-pin__status emp-pin__status--${st.phase}`
  status.setAttribute('data-status', '1')
  status.textContent = st.pinLabel
  status.title = st.detail

  const tierChip = document.createElement('div')
  tierChip.className = `emp-pin__tier emp-pin__tier--${main ? 'main' : stage ? 'stage' : 'side'}`
  tierChip.textContent = tier

  const imgWrap = document.createElement('div')
  imgWrap.className = 'emp-pin__img'
  imgWrap.style.borderColor = main
    ? '#fbbf24'
    : stage
      ? '#a78bfa'
      : EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other

  if (ev.imageUrl) {
    const img = document.createElement('img')
    img.src = toSquareImageUrl(ev.imageUrl, 160)
    img.alt = ''
    img.loading = 'eager'
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'
    img.onerror = () => {
      imgWrap.classList.add('emp-pin__img--fallback')
      img.remove()
      imgWrap.textContent = (ev.title || '?').slice(0, 1).toUpperCase()
    }
    imgWrap.appendChild(img)
  } else {
    imgWrap.classList.add('emp-pin__img--fallback')
    imgWrap.textContent = (ev.title || '?').slice(0, 1).toUpperCase()
  }

  const label = document.createElement('div')
  label.className = 'emp-pin__label'
  label.textContent = shortEventTitle(ev.title, main ? 28 : 22)

  visual.appendChild(status)
  visual.appendChild(tierChip)
  visual.appendChild(imgWrap)
  visual.appendChild(label)
  root.appendChild(visual)
  return root
}

function applyPinStatus(
  el: HTMLElement,
  ev: SideEvent,
  now: Date,
  locale: UiLocale = 'vi',
) {
  const st = getSideEventStatus(ev, now, locale)
  const chip = el.querySelector('[data-status]') as HTMLElement | null
  if (chip) {
    chip.textContent = st.pinLabel
    chip.className = `emp-pin__status emp-pin__status--${st.phase}`
    chip.title = st.detail
  }
  el.classList.toggle('emp-pin--live', st.phase === 'live')
  el.classList.toggle('emp-pin--ended', st.phase === 'ended')
  el.classList.toggle('emp-pin--upcoming', st.phase === 'upcoming')
  el.title = `${ev.title} · ${st.detail}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
}

export function EventMapPage() {
  const { locale, setLocale, tt } = useEventMapLocale()
  const localeRef = useRef(locale)
  localeRef.current = locale
  const ttRef = useRef(tt)
  ttRef.current = tt

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const originHubRef = useRef<Marker | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const listRefs = useRef<Map<string, HTMLElement>>(new Map())
  const deepLinkApplied = useRef(false)
  /** Only auto-fit when filter set changes — never fight user zoom/pan. */
  const lastFitKeyRef = useRef<string>('')
  const userMovedMapRef = useRef(false)

  const initialParams = useMemo(() => parseEventMapParams(), [])

  const [dataset, setDataset] = useState<SideEventDataset | null>(null)
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>(
    () => initialParams.date || '__default__',
  )
  const [typeFilter, setTypeFilter] = useState<SideEventType | 'all'>('all')
  const [freeOnly, setFreeOnly] = useState(false)
  /** Focus list on dateTbd / locationTbd events only */
  const [tbdFocus, setTbdFocus] = useState(false)
  const [query, setQuery] = useState('')
  const timelineElRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialParams.id || null,
  )
  const [mapReady, setMapReady] = useState(false)
  const [distOrigin, setDistOrigin] = useState<'sala' | 'me' | 'selected'>(
    'sala',
  )
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [geoBusy, setGeoBusy] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('upcoming')
  const [sheetMode, setSheetMode] = useState<SheetMode>(() =>
    isMobileViewport() ? 'half' : 'full',
  )
  const [isMobile, setIsMobile] = useState(() => isMobileViewport())
  /** Collapse distance/sort tools on small screens */
  const [toolsOpen, setToolsOpen] = useState(false)
  /** Collapse calendar/timeline strip to free map space */
  const [filtersOpen, setFiltersOpen] = useState(true)
  const sheetTouchY = useRef<number | null>(null)
  /** Wall-clock tick so LIVE badges / liveCount stay correct (esp. multi-day Main). */
  const [nowTick, setNowTick] = useState(() => Date.now())
  const today = todayVn()
  const nowHm = nowHmVn()
  const nowDate = useMemo(() => new Date(nowTick), [nowTick])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const sync = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (!mobile) {
        setToolsOpen(true)
        setFiltersOpen(true)
        setSheetMode('full')
      }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Tick pin chips + list LIVE state every second
  useEffect(() => {
    if (!dataset) return
    const byId = new Map(dataset.events.map((e) => [e.id, e]))
    const tick = () => {
      const now = new Date()
      setNowTick(now.getTime())
      if (!mapReady) return
      for (const [id, marker] of markersRef.current) {
        const ev = byId.get(id)
        if (!ev) continue
        applyPinStatus(marker.getElement(), ev, now, localeRef.current)
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [dataset, mapReady])

  useEffect(() => {
    let cancelled = false
    void loadEventsWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
      setSource(r.source)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Default date: deep link → today (if has events) → all
  useEffect(() => {
    if (!dataset || dateFilter !== '__default__') return
    const hasToday = dataset.events.some((e) => eventOccursOnDate(e, today))
    setDateFilter(hasToday ? today : 'all')
  }, [dataset, dateFilter, today])

  // Sync deep link when filters/selection change
  useEffect(() => {
    if (dateFilter === '__default__') return
    writeEventMapParams({
      id: selectedId,
      date: dateFilter === 'all' ? null : dateFilter,
    })
  }, [selectedId, dateFilter])

  const dates = useMemo(() => {
    if (!dataset) return []
    return calendarStripDates(dataset.dateRange, dataset.events)
  }, [dataset])

  const calMonthLabel = useMemo(() => {
    if (!dates.length) return 'Conviction week'
    // Prefer mid-range label (stable month for 13–16/08)
    const mid = dates[Math.floor(dates.length / 2)] || dates[0]
    return formatMonthYear(mid, locale)
  }, [dates, locale])

  const tbdDateCount = useMemo(
    () => (dataset ? dataset.events.filter((e) => e.dateTbd).length : 0),
    [dataset],
  )

  const totalEvents = dataset?.events.length ?? 0

  const typeCounts = useMemo(() => {
    const m = new Map<SideEventType, number>()
    if (!dataset) return m
    for (const t of EVENT_TYPES) m.set(t, 0)
    for (const ev of dataset.events) {
      m.set(ev.type, (m.get(ev.type) || 0) + 1)
    }
    return m
  }, [dataset])

  const selectedEvent = useMemo(
    () => dataset?.events.find((e) => e.id === selectedId) || null,
    [dataset, selectedId],
  )

  const liveCount = useMemo(() => {
    if (!dataset) return 0
    return dataset.events.filter((e) => isLive(e, nowDate)).length
  }, [dataset, nowDate])

  const distanceFrom = useMemo(() => {
    if (distOrigin === 'me' && userLoc) {
      return { lat: userLoc.lat, lng: userLoc.lng, label: 'bạn' }
    }
    if (
      distOrigin === 'selected' &&
      selectedEvent &&
      !selectedEvent.locationTbd
    ) {
      return {
        lat: selectedEvent.lat,
        lng: selectedEvent.lng,
        label: shortEventTitle(selectedEvent.title, 18),
      }
    }
    return {
      lat: dataset?.venue.lat ?? SALA_VENUE.lat,
      lng: dataset?.venue.lng ?? SALA_VENUE.lng,
      label: 'Conviction',
    }
  }, [distOrigin, userLoc, selectedEvent, dataset])

  const filtered = useMemo(() => {
    if (!dataset) return []
    const q = query.trim().toLowerCase()
    const list = dataset.events.filter((ev) => {
      if (tbdFocus) {
        if (!ev.dateTbd && !ev.locationTbd) return false
      } else if (
        !matchesDateFilter(
          ev,
          dateFilter === '__default__' ? 'all' : dateFilter,
        )
      ) {
        return false
      }
      if (typeFilter !== 'all' && ev.type !== typeFilter) return false
      if (freeOnly && !ev.free) return false
      if (q) {
        const hay =
          `${ev.title} ${ev.host} ${ev.venue} ${ev.address}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (sortMode === 'nearest') {
      return [...list].sort((a, b) => {
        const da = eventDistanceKm(distanceFrom, a)
        const db = eventDistanceKm(distanceFrom, b)
        if (da == null && db == null) return a.title.localeCompare(b.title)
        if (da == null) return 1
        if (db == null) return -1
        return da - db
      })
    }
    if (sortMode === 'upcoming') {
      return sortEventsUpcoming(list, today, nowHm)
    }
    return sortEvents(list)
  }, [
    dataset,
    dateFilter,
    typeFilter,
    freeOnly,
    tbdFocus,
    query,
    sortMode,
    distanceFrom,
    today,
    nowHm,
  ])

  const distanceLabelFor = (ev: SideEvent): string | null => {
    if (ev.locationTbd) return null
    if (distOrigin === 'selected' && ev.id === selectedId) {
      return locale === 'en' ? 'Selected' : 'Đang chọn'
    }
    const km = eventDistanceKm(distanceFrom, ev)
    if (km == null) return null
    return formatDistanceWithDrive(km, distanceFrom.label, locale)
  }

  const requestMyLocation = () => {
    if (!navigator.geolocation) {
      setDistOrigin('sala')
      return
    }
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setDistOrigin('me')
        setSortMode('nearest')
        setGeoBusy(false)
      },
      () => {
        setGeoBusy(false)
        setDistOrigin('sala')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }

  const mapEvents = useMemo(
    () => filtered.filter((ev) => !ev.locationTbd),
    [filtered],
  )

  /** Active day for timeline (concrete YYYY-MM-DD only). */
  const timelineDate =
    dateFilter !== 'all' &&
    dateFilter !== 'tbd' &&
    dateFilter !== '__default__' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)
      ? dateFilter
      : null

  const dayTimeline = useMemo(() => {
    if (!dataset || !timelineDate) return null
    return buildDayTimeline(dataset.events, timelineDate)
  }, [dataset, timelineDate])

  /** Conflicts among side events (Main excluded) for the filtered set. */
  const conflictMap = useMemo(() => {
    if (!filtered.length) return new Map<string, SideEvent[]>()
    // When viewing one day, only that day's overlaps matter for badges
    const pool = timelineDate
      ? filtered.filter((e) => eventOccursOnDate(e, timelineDate))
      : filtered
    return buildConflictMap(pool, { includeMain: false })
  }, [filtered, timelineDate])

  /** Actionable summary chips (count / conflict / TBD). */
  const summaryChips = useMemo(() => {
    if (!dataset) {
      return { events: 0, conflicts: 0, tbd: 0 }
    }
    const scope =
      timelineDate && !tbdFocus
        ? dataset.events.filter((e) => eventOccursOnDate(e, timelineDate))
        : dataset.events
    // Event count = current filtered list (what user sees)
    const events = filtered.length
    // Conflicts: prefer day timeline; else count unique conflicted ids in scope
    let conflicts = dayTimeline?.conflictedSideCount ?? 0
    if (!dayTimeline) {
      const conf = buildConflictMap(scope, { includeMain: false })
      conflicts = [...conf.values()].filter((v) => v.length > 0).length
    }
    const tbd = dataset.events.filter((e) => e.dateTbd || e.locationTbd).length
    return { events, conflicts, tbd }
  }, [dataset, filtered, timelineDate, tbdFocus, dayTimeline])

  const focusConflictTimeline = () => {
    setTbdFocus(false)
    setFiltersOpen(true)
    if (!timelineDate && dataset) {
      const dayWithConflict = dates.find((d) => {
        const tl = buildDayTimeline(dataset.events, d)
        return (tl?.conflictedSideCount ?? 0) > 0
      })
      if (dayWithConflict) setDate(dayWithConflict)
    }
    requestAnimationFrame(() => {
      timelineElRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    })
  }

  const focusTbd = () => {
    setTbdFocus(true)
    setTypeFilter('all')
    setFreeOnly(false)
    setQuery('')
    setFiltersOpen(true)
    if (isMobile) setSheetMode('half')
  }

  const clearInsightFilters = () => {
    setTbdFocus(false)
    setTypeFilter('all')
    setFreeOnly(false)
    setQuery('')
  }

  /** Display lat/lng with spiderfy when several events share a venue pin. */
  const pinPositions = useMemo(
    () => pinDisplayPositions(mapEvents),
    [mapEvents],
  )

  const pinPositionsRef = useRef(pinPositions)
  pinPositionsRef.current = pinPositions
  const datasetRef = useRef(dataset)
  datasetRef.current = dataset

  const displayLngLat = (ev: SideEvent): { lat: number; lng: number } => {
    if (ev.locationTbd) {
      const v = datasetRef.current?.venue ?? SALA_VENUE
      return { lat: v.lat, lng: v.lng }
    }
    return (
      pinPositionsRef.current.get(ev.id) ?? { lat: ev.lat, lng: ev.lng }
    )
  }

  const grouped = useMemo(() => {
    const map = new Map<string, SideEvent[]>()
    const dayKey =
      dateFilter !== 'all' &&
      dateFilter !== 'tbd' &&
      dateFilter !== '__default__'
        ? dateFilter
        : null
    for (const ev of filtered) {
      // Multi-day events (Main) appear under the active day filter when set
      const key = ev.dateTbd
        ? 'tbd'
        : dayKey && eventOccursOnDate(ev, dayKey)
          ? dayKey
          : ev.date
      const list = map.get(key) || []
      list.push(ev)
      map.set(key, list)
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === 'tbd') return 1
      if (b === 'tbd') return -1
      return a.localeCompare(b)
    })
    return keys.map((k) => [k, map.get(k)!] as const)
  }, [filtered, dateFilter])

  const countsByDate = useMemo(() => {
    const m = new Map<string, number>()
    if (!dataset) return m
    for (const d of dates) {
      m.set(d, dataset.events.filter((e) => eventOccursOnDate(e, d)).length)
    }
    return m
  }, [dataset, dates])

  /** Up to 3 Luma covers per day for calendar foot (replaces dots). */
  const thumbsByDate = useMemo(() => {
    const m = new Map<string, SideEvent[]>()
    if (!dataset) return m
    for (const d of dates) {
      const list = dataset.events
        .filter((e) => eventOccursOnDate(e, d))
        .sort((a, b) => {
          // Prefer events with image, then featured, then earlier start
          const ai = a.imageUrl ? 0 : 1
          const bi = b.imageUrl ? 0 : 1
          if (ai !== bi) return ai - bi
          if (a.featured !== b.featured) return a.featured ? -1 : 1
          return (a.startTime || '').localeCompare(b.startTime || '')
        })
        .slice(0, 3)
      m.set(d, list)
    }
    return m
  }, [dataset, dates])

  // Lock page scroll while on event map (pinch-zoom was scrolling the whole UI)
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    const prevHtmlH = html.style.height
    const prevBodyH = body.style.height
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.height = '100%'
    body.style.height = '100%'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
      html.style.height = prevHtmlH
      body.style.height = prevBodyH
    }
  }, [])

  // Init map — 2D only
  useEffect(() => {
    const container = mapEl.current
    if (!container) return

    let cancelled = false
    let ready = false
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [SALA_VENUE.lng, SALA_VENUE.lat],
      zoom: 12.6,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      maxBounds: HCMC_BOUNDS,
      attributionControl: { compact: true },
      // Avoid browser page zoom fighting map zoom on some trackpads
      cooperativeGestures: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-right',
    )
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right',
    )

    const safeResize = () => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }

    const markReady = () => {
      if (cancelled || ready) return
      ready = true
      setMapReady(true)
      requestAnimationFrame(safeResize)
    }

    // User zoom/pan → stop auto fitBounds until filters change
    const onUserMove = () => {
      userMovedMapRef.current = true
    }
    map.on('dragstart', onUserMove)
    map.on('zoomstart', (e) => {
      // programmatic zoom also fires; only flag if originalEvent from user
      if (e.originalEvent) userMovedMapRef.current = true
    })
    map.on('rotatestart', onUserMove)

    map.once('load', markReady)
    map.once('idle', markReady)
    map.on('error', (e) => {
      console.warn('[EventMap] map error', e?.error || e)
      markReady()
    })
    const fallbackTimer = window.setTimeout(markReady, 2000)

    mapRef.current = map
    const markers = markersRef.current

    const onWinResize = () => safeResize()
    window.addEventListener('resize', onWinResize)
    window.addEventListener('orientationchange', onWinResize)

    // Container size changes (mobile sheet open/close) without window resize
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        // rAF: wait for layout paint after sheet max-height transition
        requestAnimationFrame(safeResize)
      })
      ro.observe(container)
      const body = container.closest('.emp__body')
      if (body) ro.observe(body)
    }

    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('resize', onWinResize)
      window.removeEventListener('orientationchange', onWinResize)
      ro?.disconnect()
      map.off('dragstart', onUserMove)
      popupRef.current?.remove()
      popupRef.current = null
      for (const m of markers.values()) m.remove()
      markers.clear()
      originHubRef.current?.remove()
      originHubRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  /** Keep popup fully visible inside map (above mobile sheet / side panel). */
  const panPopupIntoView = (map: MapLibreMap) => {
    const el = popupRef.current?.getElement()
    if (!el) return
    const mapRect = map.getContainer().getBoundingClientRect()
    let topLimit = mapRect.top + 10
    let bottomLimit = mapRect.bottom - 12
    let leftLimit = mapRect.left + 10
    let rightLimit = mapRect.right - 10

    // Mobile bottom sheet covers lower map
    if (isMobileViewport()) {
      const panel = document.querySelector('.emp__panel') as HTMLElement | null
      if (panel) {
        const pr = panel.getBoundingClientRect()
        if (pr.top < mapRect.bottom - 4) {
          bottomLimit = Math.min(bottomLimit, pr.top - 10)
        }
      }
    } else {
      // Desktop list panel on the right
      const panel = document.querySelector('.emp__panel') as HTMLElement | null
      if (panel) {
        const pr = panel.getBoundingClientRect()
        if (pr.left < mapRect.right && pr.left > mapRect.left) {
          rightLimit = Math.min(rightLimit, pr.left - 10)
        }
      }
    }

    const pop = el.getBoundingClientRect()
    // Available band may be short — clamp max height so content scrolls
    const availH = Math.max(160, bottomLimit - topLimit)
    const content = el.querySelector(
      '.maplibregl-popup-content',
    ) as HTMLElement | null
    if (content) {
      content.style.maxHeight = `${Math.min(availH, 640)}px`
    }

    let dx = 0
    let dy = 0
    if (pop.left < leftLimit) dx = pop.left - leftLimit
    if (pop.right > rightLimit) dx = pop.right - rightLimit
    if (pop.top < topLimit) dy = pop.top - topLimit
    if (pop.bottom > bottomLimit) dy = pop.bottom - bottomLimit
    if (dx !== 0 || dy !== 0) {
      map.panBy([dx, dy], { duration: 280 })
    }
  }

  const openPopup = (ev: SideEvent) => {
    const map = mapRef.current
    if (!map) return
    popupRef.current?.remove()
    const loc = localeRef.current
    const tr = ttRef.current
    const st = getSideEventStatus(ev, new Date(), loc)
    const live = st.phase === 'live'
    const isTodayEv = eventOccursOnDate(ev, todayVn())
    // Use spiderfied display position (overlap fix); real coords stay for directions
    const { lng, lat } = displayLngLat(ev)
    // Width matches Luma-style 1:1 cover (square image fills card width)
    const wide = isMobileViewport()
      ? Math.min(320, Math.max(280, map.getContainer().clientWidth - 24))
      : Math.min(340, Math.max(300, map.getContainer().clientWidth - 48))
    const popup = new maplibregl.Popup({
      offset: 96,
      maxWidth: `${wide}px`,
      className: 'emp-popup emp-popup--detail',
      closeButton: true,
      anchor: 'bottom',
      focusAfterOpen: false,
    })
      .setLngLat([lng, lat])
      .setHTML(
        popupHtml(ev, {
          live,
          today: isTodayEv,
          distanceLabel: distanceLabelFor(ev) || undefined,
          statusLabel: st.detail,
          statusPhase: st.phase,
          locale: loc,
          labels: {
            badgeMain: tr('badgeMain'),
            badgeStage: tr('badgeStage'),
            badgeSide: tr('badgeSide'),
            badgeLive: tr('badgeLive'),
            badgeToday: tr('today'),
            badgeDateTbd: tr('badgeDateTbd'),
            badgeLocTbd: tr('badgeLocTbd'),
            badgeFree: tr('badgeFree'),
            register: tr('register'),
            directions: tr('directions'),
            host: tr('host'),
            place: tr('place'),
            placeTbdLong: tr('placeTbdLong'),
            pinTempNote: tr('pinTempNote'),
            whenTbd: tr('whenTbd'),
          },
        }),
      )
      .addTo(map)
    popupRef.current = popup
    // Layout then pan so card is not clipped by edges / sheet
    requestAnimationFrame(() => {
      panPopupIntoView(map)
      window.setTimeout(() => panPopupIntoView(map), 320)
    })
  }

  const selectEvent = (ev: SideEvent, fly = true) => {
    setSelectedId(ev.id)
    // On mobile: peek sheet + collapse filters so map/popup stay usable
    if (isMobileViewport()) {
      setSheetMode('peek')
      setFiltersOpen(false)
      setToolsOpen(false)
    }
    const map = mapRef.current
    const target = displayLngLat(ev)
    const zoom = ev.locationTbd
      ? Math.max(map?.getZoom() ?? 13, 13.2)
      : Math.max(map?.getZoom() ?? 14.4, 14.6)

    if (map && fly) {
      userMovedMapRef.current = false
      let opened = false
      const openAfter = () => {
        if (opened) return
        opened = true
        openPopup(ev)
      }
      map.once('moveend', openAfter)
      map.flyTo({
        center: [target.lng, target.lat],
        zoom,
        speed: 1.15,
        pitch: 0,
        bearing: 0,
        essential: true,
      })
      // If already near target, moveend may not fire
      window.setTimeout(() => {
        map.off('moveend', openAfter)
        openAfter()
      }, 850)
    } else if (map) {
      openPopup(ev)
    }
    // After paint, scroll list card into view
    requestAnimationFrame(() => {
      const el = listRefs.current.get(ev.id)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
  const selectEventRef = useRef(selectEvent)
  selectEventRef.current = selectEvent

  // When mobile sheet height changes, resize map canvas
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const t = window.setTimeout(() => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [sheetMode, mapReady])

  // Apply deep-link selection once data + map ready
  useEffect(() => {
    if (!dataset || !mapReady || deepLinkApplied.current) return
    const { id } = parseEventMapParams()
    if (!id) {
      deepLinkApplied.current = true
      return
    }
    const ev = dataset.events.find((e) => e.id === id)
    if (ev) {
      deepLinkApplied.current = true
      // slight delay so markers exist
      requestAnimationFrame(() => selectEvent(ev, true))
    } else {
      deepLinkApplied.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, mapReady])

  // Origin hub only when measuring from "me" or selected event
  // (Conviction venue already has the gold pin)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const showHub = distOrigin === 'me' || distOrigin === 'selected'
    if (!showHub) {
      originHubRef.current?.remove()
      originHubRef.current = null
      return
    }
    if (!originHubRef.current) {
      const el = document.createElement('div')
      el.className = 'emp-dist-origin'
      el.innerHTML =
        '<span class="emp-dist-origin__ring"></span><span class="emp-dist-origin__core"></span>'
      el.title = `Gốc đo: ${distanceFrom.label}`
      originHubRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([distanceFrom.lng, distanceFrom.lat])
        .addTo(map)
    } else {
      originHubRef.current.setLngLat([distanceFrom.lng, distanceFrom.lat])
      originHubRef.current.getElement().title = `Gốc đo: ${distanceFrom.label}`
    }
  }, [mapReady, distanceFrom, distOrigin])

  // Sync side-event pin markers (no main venue gold dot)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !dataset) return

    const keep = new Set(mapEvents.map((e) => e.id))
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    const now = new Date()
    for (const ev of mapEvents) {
      const pos = pinPositions.get(ev.id) ?? { lat: ev.lat, lng: ev.lng }
      const existing = markersRef.current.get(ev.id)
      const pinKey = `${ev.imageUrl || ''}|${ev.title}|${ev.type}|${ev.featured ? 1 : 0}|${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`
      if (!existing || existing.getElement().dataset.pinKey !== pinKey) {
        existing?.remove()
        const el = buildLumaPinEl(ev, now, localeRef.current, {
          main: ttRef.current('tierMain'),
          stage: ttRef.current('tierStage'),
          side: ttRef.current('tierSide'),
        })
        el.dataset.pinKey = pinKey
        el.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation()
          // Always use latest selectEvent (pin positions / filters)
          selectEventRef.current(ev, true)
        })
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map)
        markersRef.current.set(ev.id, marker)
        el.classList.toggle('is-active', selectedId === ev.id)
      } else {
        existing.setLngLat([pos.lng, pos.lat])
        const el = existing.getElement()
        el.classList.toggle('is-active', selectedId === ev.id)
        applyPinStatus(el, ev, now, localeRef.current)
      }
    }

    // Auto-fit only when filter set changes (not after user zoom/pan)
    const fitKey = `${dateFilter}|${typeFilter}|${freeOnly}|${query}|${mapEvents.map((e) => e.id).join(',')}`
    const shouldFit =
      mapEvents.length > 0 &&
      !selectedId &&
      fitKey !== lastFitKeyRef.current &&
      !userMovedMapRef.current

    if (shouldFit || (mapEvents.length > 0 && lastFitKeyRef.current === '')) {
      // Always fit on first paint; later only when filter key changes and user hasn't moved
      const first = lastFitKeyRef.current === ''
      if (first || fitKey !== lastFitKeyRef.current) {
        if (first || !userMovedMapRef.current) {
          lastFitKeyRef.current = fitKey
          userMovedMapRef.current = false
          const bounds = new maplibregl.LngLatBounds()
          bounds.extend([dataset.venue.lng, dataset.venue.lat])
          for (const ev of mapEvents) {
            const p = pinPositions.get(ev.id) ?? { lat: ev.lat, lng: ev.lng }
            bounds.extend([p.lng, p.lat])
          }
          try {
            map.fitBounds(bounds, {
              padding: {
                top: 64,
                bottom: isMobileViewport()
                  ? sheetMode === 'full'
                    ? 280
                    : sheetMode === 'half'
                      ? 200
                      : 88
                  : 64,
                left: 40,
                right: 40,
              },
              maxZoom: 14.2,
              duration: first ? 650 : 500,
              pitch: 0,
              bearing: 0,
              essential: true,
            })
          } catch {
            /* ignore */
          }
        } else {
          lastFitKeyRef.current = fitKey
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, mapEvents, mapReady, selectedId, today, nowHm, pinPositions, locale])

  const setDate = (d: string) => {
    setDateFilter(d)
    setTbdFocus(false)
    setSelectedId(null)
    userMovedMapRef.current = false
    lastFitKeyRef.current = '' // force re-fit for new day filter
  }

  const cycleSheet = () => {
    setSheetMode((m) => (m === 'peek' ? 'half' : m === 'half' ? 'full' : 'peek'))
  }

  const expandSheet = () => {
    setSheetMode((m) => (m === 'peek' ? 'half' : m === 'half' ? 'full' : 'full'))
  }

  const collapseSheet = () => {
    setSheetMode((m) => (m === 'full' ? 'half' : m === 'half' ? 'peek' : 'peek'))
  }

  const onSheetTouchStart = (e: { touches: ArrayLike<{ clientY: number }> }) => {
    sheetTouchY.current = e.touches[0]?.clientY ?? null
  }

  const onSheetTouchEnd = (e: {
    changedTouches: ArrayLike<{ clientY: number }>
  }) => {
    const start = sheetTouchY.current
    sheetTouchY.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientY
    if (end == null) return
    const dy = end - start
    if (dy > 48) collapseSheet()
    else if (dy < -48) expandSheet()
  }

  const panelClass =
    sheetMode === 'peek'
      ? 'emp__panel emp__panel--peek'
      : sheetMode === 'half'
        ? 'emp__panel emp__panel--half'
        : 'emp__panel emp__panel--full'

  return (
    <div
      className={`emp${isMobile ? ' emp--mobile' : ''}${!filtersOpen ? ' emp--filters-collapsed' : ''}`}
    >
      <header className="emp__header">
        <div className="emp__brand">
          <h1 className="emp__brand-title">
            <span className="emp__brand-title-full">{tt('pageTitle')}</span>
            <span className="emp__brand-title-short">{tt('pageTitleShort')}</span>
          </h1>
          <p className="emp__brand-sub">
            {tt('mainHeader', {
              window: MAIN_FORUM_SCHEDULE.windowLabel,
              venue: MAIN_FORUM_SCHEDULE.venue,
            })}
            {liveCount > 0 ? ` · ${tt('liveCount', { n: liveCount })}` : ''}
            {source !== 'server' ? ` · ${source}` : ''}
          </p>
        </div>
        <div className="emp__header-actions">
          <div
            className="emp__btn-group emp-lang"
            role="group"
            aria-label={tt('langToggle')}
          >
            <button
              type="button"
              className={`emp__btn emp-lang__btn ${locale === 'vi' ? 'emp__btn--primary' : ''}`}
              onClick={() => setLocale('vi')}
              aria-pressed={locale === 'vi'}
              title="Tiếng Việt"
            >
              {tt('langVi')}
            </button>
            <button
              type="button"
              className={`emp__btn emp-lang__btn ${locale === 'en' ? 'emp__btn--primary' : ''}`}
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
              title="English"
            >
              {tt('langEn')}
            </button>
          </div>
          {isMobile && (
            <button
              type="button"
              className={`emp__btn emp-tools-toggle ${toolsOpen ? 'emp__btn--primary' : ''}`}
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
            >
              {toolsOpen ? tt('toolsLess') : tt('toolsMore')}
            </button>
          )}
          <div
            className={`emp__tools-row${!isMobile || toolsOpen ? ' is-open' : ''}`}
          >
            <div className="emp__btn-group" role="group" aria-label={tt('distGroup')}>
              <button
                type="button"
                className={`emp__btn ${distOrigin === 'sala' ? 'emp__btn--primary' : ''}`}
                onClick={() => setDistOrigin('sala')}
                title={tt('fromConvictionTitle')}
              >
                {tt('fromConviction')}
              </button>
              <button
                type="button"
                className={`emp__btn ${distOrigin === 'me' ? 'emp__btn--primary' : ''}`}
                disabled={geoBusy}
                onClick={() => {
                  if (userLoc) {
                    setDistOrigin('me')
                    setSortMode('nearest')
                  } else {
                    requestMyLocation()
                  }
                }}
                title={geoBusy ? tt('locating') : tt('fromMeTitle')}
                aria-busy={geoBusy}
              >
                {geoBusy ? (
                  <span className="emp-spinner" aria-hidden />
                ) : (
                  tt('fromMe')
                )}
              </button>
              <button
                type="button"
                className={`emp__btn ${distOrigin === 'selected' ? 'emp__btn--primary' : ''}`}
                disabled={!selectedEvent || !!selectedEvent.locationTbd}
                onClick={() => {
                  if (!selectedEvent || selectedEvent.locationTbd) return
                  setDistOrigin('selected')
                  setSortMode('nearest')
                }}
                title={tt('betweenEventsTitle')}
              >
                {tt('betweenEvents')}
              </button>
            </div>
            <div className="emp__btn-group" role="group" aria-label={tt('sortGroup')}>
              <button
                type="button"
                className={`emp__btn ${sortMode === 'upcoming' ? 'emp__btn--primary' : ''}`}
                onClick={() => setSortMode('upcoming')}
                title={tt('sortUpcomingTitle')}
              >
                {tt('sortUpcoming')}
              </button>
              <button
                type="button"
                className={`emp__btn ${sortMode === 'nearest' ? 'emp__btn--primary' : ''}`}
                onClick={() => setSortMode('nearest')}
                title={tt('sortNearestTitle')}
              >
                {tt('sortNearest')}
              </button>
            </div>
            <button
              type="button"
              className="emp__btn emp-toggle-list"
              onClick={cycleSheet}
            >
              {sheetMode === 'peek'
                ? tt('openList')
                : sheetMode === 'half'
                  ? tt('expandList')
                  : tt('collapseList')}
            </button>
            <a
              className="emp__btn"
              href="https://luma.com/conviction-2026"
              target="_blank"
              rel="noopener noreferrer"
            >
              Luma
            </a>
            <a
              className="emp__btn emp__btn--logo"
              href={CONVICTION_HOME}
              target="_blank"
              rel="noopener noreferrer"
              title="Conviction 2026"
              aria-label="Conviction 2026 — conviction.vn"
            >
              <img
                className="emp__conviction-logo"
                src={CONVICTION_LOGO}
                alt="Conviction"
                width={120}
                height={20}
                decoding="async"
              />
            </a>
          </div>
        </div>
      </header>

      {isMobile && (
        <div className="emp-chrome-bar emp-chrome-bar--mobile">
          <button
            type="button"
            className="emp-chrome-bar__btn is-primary"
            onClick={() => {
              if (sheetMode === 'peek') setSheetMode('half')
              else if (sheetMode === 'half') setSheetMode('full')
              else setSheetMode('half')
            }}
          >
            {sheetMode === 'peek' ? tt('fabListOpen') : tt('fabList')}
            {filtered.length ? ` · ${filtered.length}` : ''}
          </button>
          <button
            type="button"
            className="emp-chrome-bar__btn"
            onClick={() => {
              requestMyLocation()
              setToolsOpen(false)
            }}
            disabled={geoBusy}
            title={geoBusy ? tt('locating') : tt('fabLocate')}
            aria-busy={geoBusy}
          >
            {geoBusy ? (
              <span className="emp-spinner" aria-hidden />
            ) : (
              tt('fabLocate')
            )}
          </button>
        </div>
      )}

      <div className={`emp__filters${filtersOpen ? '' : ' is-collapsed'}`}>
        <div className="emp-week" role="group" aria-label={tt('filterDays')}>
          <div className="emp-week__bar emp-week__bar--sticky">
            <div className="emp-week__meta">
              <div className="emp-week__title-row">
                <span className="emp-week__month">{calMonthLabel}</span>
                <div className="emp-week__seg" role="tablist" aria-label={tt('scope')}>
                  <button
                    type="button"
                    role="tab"
                    className={`emp-week__seg-btn ${dateFilter === 'all' ? 'is-on' : ''}`}
                    onClick={() => setDate('all')}
                  >
                    {tt('all')}
                  </button>
                  <button
                    type="button"
                    className={`emp-week__seg-btn emp-week__seg-btn--min ${!filtersOpen ? 'is-on' : ''}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    title={
                      filtersOpen ? tt('calendarHide') : tt('calendarShow')
                    }
                  >
                    {filtersOpen ? tt('calendarHide') : tt('calendarShow')}
                  </button>
                </div>
              </div>
              {dateFilter !== 'all' &&
              dateFilter !== 'tbd' &&
              dateFilter !== '__default__' ? (
                <span className="emp-week__selected-label">
                  {formatWeekdayShort(dateFilter, locale)} ·{' '}
                  {formatShortDate(dateFilter)}
                  {mainForumMeta(dateFilter)
                    ? ` · ${mainForumMeta(dateFilter)!.short}`
                    : ''}
                  {!filtersOpen ? ` · ${tt('calendarCollapsedHint')}` : ''}
                </span>
              ) : (
                <span className="emp-week__selected-label">
                  {dateFilter === 'tbd'
                    ? tt('dateUnconfirmed')
                    : tt('eventsInWeek', { n: totalEvents })}
                  {!filtersOpen ? ` · ${tt('calendarCollapsedHint')}` : ''}
                </span>
              )}
            </div>
          </div>

          <div
            className={`emp-week__collapsible${filtersOpen ? '' : ' is-collapsed'}`}
          >
          <div className="emp-week__days" role="listbox" aria-label={tt('pickDay')}>
            {dates.map((d) => {
              const count = countsByDate.get(d) || 0
              const isToday = d === today
              const isSelected = dateFilter === d
              const empty = count === 0
              const main = mainForumMeta(d)
              const isMain = Boolean(main)
              const thumbs = thumbsByDate.get(d) || []
              const extra = Math.max(0, count - thumbs.length)
              return (
                <button
                  key={d}
                  type="button"
                  role="option"
                  className={[
                    'emp-week__day',
                    isMain ? 'emp-week__day--main' : '',
                    main?.day === 1 ? 'emp-week__day--d1' : '',
                    main?.day === 2 ? 'emp-week__day--d2' : '',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                    empty && !isMain ? 'is-empty' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setDate(d)}
                  disabled={empty && !isMain}
                  aria-pressed={isSelected}
                  aria-selected={isSelected}
                  title={
                    main
                      ? tt('dayTitleMain', {
                          short: main.short,
                          track: main.track,
                          sides: count
                            ? tt('daySides', { n: count })
                            : '',
                        })
                      : tt('dayTitle', {
                          date: formatShortDate(d),
                          n: count,
                        })
                  }
                >
                  <span className="emp-week__dow">
                    {formatWeekdayShort(d, locale)}
                  </span>
                  <span className="emp-week__num">{formatDayNum(d)}</span>
                  <span className="emp-week__foot">
                    {empty && !isMain ? (
                      <span className="emp-week__thumbs emp-week__thumbs--empty" />
                    ) : thumbs.length ? (
                      <span className="emp-week__thumbs" aria-hidden>
                        {thumbs.map((ev) => (
                          <span
                            key={ev.id}
                            className="emp-week__thumb"
                            title={ev.title}
                          >
                            {ev.imageUrl ? (
                              <img
                                src={toSquareImageUrl(ev.imageUrl, 72)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="emp-week__thumb-fb">
                                {(ev.title || '?').slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </span>
                        ))}
                        {extra > 0 ? (
                          <span className="emp-week__thumb emp-week__thumb--more">
                            +{extra}
                          </span>
                        ) : null}
                      </span>
                    ) : isMain ? (
                      <span className="emp-week__main-label">
                        {main!.day === 1 ? 'Main 1' : 'Main 2'}
                      </span>
                    ) : (
                      <span className="emp-week__thumbs emp-week__thumbs--empty" />
                    )}
                  </span>
                </button>
              )
            })}

            {tbdDateCount > 0 && (
              <button
                type="button"
                role="option"
                className={`emp-week__day emp-week__day--tbd ${dateFilter === 'tbd' ? 'is-selected' : ''}`}
                onClick={() => setDate('tbd')}
                aria-pressed={dateFilter === 'tbd'}
                aria-selected={dateFilter === 'tbd'}
                title={tt('dateNotSet')}
              >
                <span className="emp-week__dow">TBD</span>
                <span className="emp-week__num emp-week__num--tbd">?</span>
                <span className="emp-week__foot">
                  <span className="emp-week__main-label">{tbdDateCount}</span>
                </span>
              </button>
            )}
          </div>

          {dayTimeline && (
            <div
              className="emp-timeline"
              ref={timelineElRef}
              aria-label={tt('timelineAria')}
            >
              <div className="emp-timeline__head">
                <div>
                  <span className="emp-timeline__title">
                    {tt('timelineTitle')}
                  </span>
                  <span className="emp-timeline__sub">
                    {tt('timelineSub', {
                      date: formatShortDate(dayTimeline.date),
                    })}
                  </span>
                </div>
                {dayTimeline.conflictedSideCount > 0 ? (
                  <span className="emp-timeline__warn">
                    {tt('timelineWarn', {
                      n: dayTimeline.conflictedSideCount,
                    })}
                  </span>
                ) : (
                  <span className="emp-timeline__ok">{tt('timelineOk')}</span>
                )}
              </div>
              <div className="emp-timeline__hours" aria-hidden>
                {dayTimeline.hours.map((h) => {
                  const span =
                    dayTimeline.rangeEndMin - dayTimeline.rangeStartMin
                  const left =
                    ((h * 60 - dayTimeline.rangeStartMin) / span) * 100
                  if (left < -2 || left > 102) return null
                  return (
                    <span
                      key={h}
                      className="emp-timeline__hour"
                      style={{ left: `${left}%` }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </span>
                  )
                })}
              </div>
              <div
                className="emp-timeline__lanes"
                style={{
                  height: `${Math.max(2, dayTimeline.laneCount) * 28 + 8}px`,
                }}
              >
                {dayTimeline.bars.map((bar) => {
                  const active = selectedId === bar.id
                  const conflicted = !bar.isMain && bar.conflictCount > 0
                  return (
                    <button
                      key={bar.id}
                      type="button"
                      className={[
                        'emp-timeline__bar',
                        bar.isMain ? 'emp-timeline__bar--main' : '',
                        bar.isStage ? 'emp-timeline__bar--stage' : '',
                        conflicted ? 'emp-timeline__bar--conflict' : '',
                        active ? 'is-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        left: `${bar.leftPct}%`,
                        width: `${bar.widthPct}%`,
                        top: `${bar.lane * 28 + 4}px`,
                        background: bar.isMain
                          ? 'linear-gradient(90deg, rgba(251,191,36,0.35), rgba(251,191,36,0.12))'
                          : conflicted
                            ? 'linear-gradient(90deg, rgba(251,146,60,0.55), rgba(248,113,113,0.35))'
                            : `linear-gradient(90deg, ${bar.color}cc, ${bar.color}55)`,
                        borderColor: conflicted
                          ? 'rgba(251, 146, 60, 0.85)'
                          : bar.color,
                      }}
                      title={`${bar.title} · ${bar.startLabel}–${bar.endLabel}${
                        conflicted
                          ? ` · ${tt('badgeConflict', { n: bar.conflictCount })}`
                          : ''
                      }`}
                      onClick={() => {
                        const ev = dataset?.events.find((e) => e.id === bar.id)
                        if (ev) selectEvent(ev, true)
                      }}
                    >
                      <span className="emp-timeline__bar-time">
                        {bar.startLabel}
                      </span>
                      <span className="emp-timeline__bar-name">
                        {bar.isMain
                          ? 'MAIN'
                          : bar.isStage
                            ? 'STAGE'
                            : shortEventTitle(bar.title, 18)}
                      </span>
                      {conflicted ? (
                        <span className="emp-timeline__bar-x">
                          ×{bar.conflictCount}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <p className="emp-timeline__legend">{tt('timelineLegend')}</p>
            </div>
          )}

          <div className="emp__filter-row emp__filter-row--types">
            <button
              type="button"
              className={`emp__chip ${typeFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => {
                setTypeFilter('all')
                userMovedMapRef.current = false
                lastFitKeyRef.current = ''
              }}
            >
              {tt('typesAll')}
            </button>
            {EVENT_TYPES.filter((t) => (typeCounts.get(t) || 0) > 0).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  className={`emp__chip ${typeFilter === t ? 'is-active' : ''}`}
                  onClick={() => {
                    setTypeFilter(t)
                    userMovedMapRef.current = false
                    lastFitKeyRef.current = ''
                  }}
                  style={
                    typeFilter === t
                      ? { background: EVENT_TYPE_COLORS[t], color: '#0f172a' }
                      : undefined
                  }
                >
                  {EVENT_TYPE_LABELS[t]} ({typeCounts.get(t)})
                </button>
              ),
            )}
            <button
              type="button"
              className={`emp__chip ${freeOnly ? 'is-active' : ''}`}
              onClick={() => {
                setFreeOnly((v) => !v)
                userMovedMapRef.current = false
                lastFitKeyRef.current = ''
              }}
            >
              {tt('freeOnly')}
            </button>
            <input
              className="emp__search"
              type="search"
              placeholder={tt('searchPh')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="emp-insight" role="group" aria-label="Insights">
              <button
                type="button"
                className="emp-insight__chip emp-insight__chip--count"
                title={tt('chipEventsTitle')}
                onClick={clearInsightFilters}
              >
                {timelineDate === today
                  ? tt('chipEventsToday', { n: summaryChips.events })
                  : timelineDate
                    ? tt('chipEventsDay', { n: summaryChips.events })
                    : tt('chipEvents', { n: summaryChips.events })}
              </button>
              {summaryChips.conflicts > 0 && (
                <button
                  type="button"
                  className="emp-insight__chip emp-insight__chip--conflict"
                  title={tt('chipConflictTitle')}
                  onClick={focusConflictTimeline}
                >
                  {tt('chipConflict', { n: summaryChips.conflicts })}
                </button>
              )}
              {summaryChips.tbd > 0 && (
                <button
                  type="button"
                  className={`emp-insight__chip emp-insight__chip--tbd${tbdFocus ? ' is-on' : ''}`}
                  title={tt('chipTbdTitle')}
                  aria-pressed={tbdFocus}
                  onClick={() => {
                    if (tbdFocus) setTbdFocus(false)
                    else focusTbd()
                  }}
                >
                  {tt('chipTbd', { n: summaryChips.tbd })}
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="emp__body">
        <div className="emp__map">
          <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
          {(loading || !mapReady) && (
            <div className="emp__loading">{tt('loading')}</div>
          )}
          <div className="emp__map-hint" aria-hidden>
            {tt('mapHint')}
          </div>
          {isMobile && (
            <div className="emp-map-fabs" role="toolbar" aria-label={tt('sheetAria')}>
              <button
                type="button"
                className="emp-map-fab"
                onClick={() => {
                  setFiltersOpen(true)
                  setSheetMode('half')
                }}
                title={tt('fabListOpen')}
              >
                {tt('fabList')}
              </button>
              <button
                type="button"
                className="emp-map-fab emp-map-fab--accent"
                onClick={() => requestMyLocation()}
                disabled={geoBusy}
                title={geoBusy ? tt('locating') : tt('fabLocate')}
                aria-busy={geoBusy}
              >
                {geoBusy ? (
                  <span className="emp-spinner emp-spinner--on-dark" aria-hidden />
                ) : (
                  '⌖'
                )}
              </button>
            </div>
          )}
        </div>

        <aside
          className={panelClass}
          aria-label={tt('sheetAria')}
          onTouchStart={onSheetTouchStart}
          onTouchEnd={onSheetTouchEnd}
        >
          <button
            type="button"
            className="emp__sheet-handle"
            onClick={cycleSheet}
            onTouchStart={onSheetTouchStart}
            onTouchEnd={onSheetTouchEnd}
            aria-label={tt('sheetAria')}
          >
            <span className="emp__sheet-grip" />
            <span className="emp__sheet-label">
              {sheetMode === 'peek'
                ? tt('openList')
                : sheetMode === 'half'
                  ? tt('expandList')
                  : tt('collapseList')}
              {filtered.length ? ` · ${filtered.length}` : ''}
            </span>
          </button>
          <div className="emp__panel-head">
            <div>
              <h2>{tt('panelTitleSimple')}</h2>
              <p>
                {dateFilter === today
                  ? tt('panelToday')
                  : dateFilter === 'all'
                    ? tt('panelAll')
                    : tt('panelDay', {
                        date: formatShortDate(dateFilter),
                      })}
                {' · '}
                {tt('panelDist', {
                  from:
                    distOrigin === 'me'
                      ? tt('fromYou')
                      : distOrigin === 'selected'
                        ? tt('fromSelected')
                        : tt('fromVenue'),
                })}
              </p>
            </div>
          </div>
          <div className="emp__list">
            {!filtered.length && (
              <div className="emp__empty">
                {dateFilter === today ? (
                  <>
                    {tt('emptyToday')}{' '}
                    <button
                      type="button"
                      className="emp__linkish"
                      onClick={() => setDate('all')}
                    >
                      {tt('all')}
                    </button>{' '}
                    {tt('orOtherDay')}
                  </>
                ) : (
                  <>{tt('emptyFilter')}</>
                )}
              </div>
            )}
            {grouped.map(([date, list]) => {
              const renderCard = (ev: SideEvent) => {
                const st = getSideEventStatus(ev, nowDate, locale)
                const live = st.phase === 'live'
                const isTodayEv = !ev.dateTbd && eventOccursOnDate(ev, today)
                const isActive = selectedId === ev.id
                const timeLabel =
                  ev.endDate && ev.endDate !== ev.date
                    ? `${formatShortDate(ev.date)} ${formatLumaTime(ev.startTime)} → ${formatShortDate(ev.endDate)} ${ev.endTime ? formatLumaTime(ev.endTime) : ''}`.trim()
                    : ev.endTime
                      ? `${formatLumaTime(ev.startTime)} – ${formatLumaTime(ev.endTime)}`
                      : formatLumaTime(ev.startTime)
                const place = ev.locationTbd
                  ? tt('placeTbd')
                  : ev.venue ||
                    ev.address ||
                    (locale === 'en' ? 'Ho Chi Minh City' : 'TP. Hồ Chí Minh')
                const dist = distanceLabelFor(ev)
                const stage = isMainVenueSideStage(ev)
                const conflicts = conflictMap.get(ev.id) || []
                const conflicted = conflicts.length > 0
                return (
                  <div
                    key={ev.id}
                    className={`emp__card emp__card--luma ${isActive ? 'is-active' : ''}${live ? ' emp__card--live' : ''}${ev.locationTbd ? ' emp__card--tbd-loc' : ''}${stage ? ' emp__card--stage' : ''}${conflicted ? ' emp__card--conflict' : ''}`}
                    ref={(node) => {
                      if (node) listRefs.current.set(ev.id, node)
                      else listRefs.current.delete(ev.id)
                    }}
                  >
                    <button
                      type="button"
                      className="emp__card-main"
                      onClick={() => selectEvent(ev, true)}
                    >
                      <div className="emp__card-body">
                        <p className="emp__card-time">
                          {ev.dateTbd ? tt('timeTbd') : timeLabel}
                          {live ? ' · LIVE' : ''}
                          {!live && st.phase === 'upcoming'
                            ? ` · ${st.pinLabel}`
                            : ''}
                          {st.phase === 'ended' ? ' · END' : ''}
                        </p>
                        <p className="emp__card-title">{ev.title}</p>
                        {ev.host ? (
                          <p className="emp__card-host">
                            <span
                              className="emp__card-host-dot"
                              aria-hidden
                            />
                            By {ev.host}
                          </p>
                        ) : null}
                        <p className="emp__card-place">
                          <span className="emp__card-pin" aria-hidden>
                            ⌖
                          </span>
                          {place}
                        </p>
                        {dist ? (
                          <p className="emp__card-dist">{dist}</p>
                        ) : ev.locationTbd ? (
                          <p className="emp__card-dist emp__card-dist--muted">
                            {tt('noCoords')}
                          </p>
                        ) : null}
                        <div className="emp__badges">
                          {stage ? (
                            <span className="emp__badge emp__badge--stage">
                              {tt('badgeStage')}
                            </span>
                          ) : (
                            <span className="emp__badge emp__badge--side">
                              {tt('badgeSide')}
                            </span>
                          )}
                          {conflicted && (
                            <span className="emp__badge emp__badge--conflict">
                              {tt('badgeConflict', { n: conflicts.length })}
                            </span>
                          )}
                          {(ev.dateTbd || ev.locationTbd) && (
                            <span className="emp__badge emp__badge--pending">
                              {ev.locationTbd
                                ? tt('badgeLocTbd')
                                : tt('badgeDateTbd')}
                            </span>
                          )}
                          {live && (
                            <span className="emp__badge emp__badge--live">
                              {tt('badgeLive')}
                            </span>
                          )}
                          {!live && isTodayEv && (
                            <span className="emp__badge emp__badge--today">
                              {tt('today')}
                            </span>
                          )}
                          {ev.free && (
                            <span className="emp__badge emp__badge--free">
                              {tt('badgeFree')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="emp__card-media">
                        {ev.imageUrl ? (
                          <img
                            src={toSquareImageUrl(ev.imageUrl, 240)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div
                            className="emp__card-media-fallback"
                            style={{
                              background: EVENT_TYPE_COLORS[ev.type],
                            }}
                          >
                            {(ev.title || '?').slice(0, 1)}
                          </div>
                        )}
                      </div>
                    </button>
                    {isActive && (
                      <div className="emp__card-detail">
                        {ev.description ? (
                          <p className="emp__card-detail-desc">
                            {ev.description}
                          </p>
                        ) : null}
                        <p className="emp__card-detail-meta">
                          {stage ? tt('metaStage') : tt('metaSide')}
                          {' · '}
                          {st.detail}
                          {ev.locationTbd ? tt('metaLocTbd') : ''}
                        </p>
                        {conflicted ? (
                          <div className="emp__card-conflict emp__card-conflict--thumbs">
                            <div className="emp__card-conflict-head">
                              <span className="emp__card-conflict-label">
                                {tt('conflictPick')}
                              </span>
                              <span className="emp__card-conflict-hint">
                                {tt('conflictPickHint')}
                              </span>
                            </div>
                            <div
                              className="emp__card-conflict-thumbs"
                              role="list"
                            >
                              {conflicts.map((other) => {
                                const time = other.endTime
                                  ? `${formatLumaTime(other.startTime)}–${formatLumaTime(other.endTime)}`
                                  : formatLumaTime(other.startTime)
                                return (
                                  <button
                                    key={other.id}
                                    type="button"
                                    role="listitem"
                                    className="emp__card-conflict-thumb"
                                    title={`${other.title} · ${time}${other.venue ? ` · ${other.venue}` : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      selectEvent(other, true)
                                    }}
                                  >
                                    {other.imageUrl ? (
                                      <img
                                        src={toSquareImageUrl(other.imageUrl, 120)}
                                        alt=""
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <span
                                        className="emp__card-conflict-thumb-fb"
                                        style={{
                                          background:
                                            EVENT_TYPE_COLORS[other.type] ||
                                            EVENT_TYPE_COLORS.other,
                                        }}
                                      >
                                        {(other.title || '?').slice(0, 1)}
                                      </span>
                                    )}
                                    <span className="emp__card-conflict-thumb-time">
                                      {other.startTime || '—'}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                        <div className="emp__card-actions">
                          {ev.link ? (
                            <a
                              className="emp__card-action emp__card-action--primary"
                              href={ev.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {tt('registerLuma')}
                            </a>
                          ) : null}
                          {!ev.locationTbd ? (
                            <a
                              className="emp__card-action"
                              href={directionsUrl(ev.lat, ev.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {tt('directions')}
                            </a>
                          ) : (
                            <a
                              className="emp__card-action"
                              href={directionsUrl(
                                SALA_VENUE.lat,
                                SALA_VENUE.lng,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {tt('mainVenue')}
                            </a>
                          )}
                          <button
                            type="button"
                            className="emp__card-action"
                            onClick={() => downloadIcs(ev)}
                          >
                            {tt('addCalendar')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <div key={date} className="emp__day-group">
                  <div className="emp__day-label">
                    {date === 'tbd'
                      ? tt('dateTbd')
                      : `${formatLumaDayLocale(date, locale)}${
                          date === today ? ` · ${tt('today')}` : ''
                        }`}
                  </div>
                  <div className="emp__section emp__section--side">
                    {list.map(renderCard)}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
