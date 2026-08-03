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
  SALA_VENUE,
  calendarStripDates,
  directionsUrl,
  eventDistanceKm,
  eventOccursOnDate,
  formatDayNum,
  formatDistanceWithDrive,
  formatLumaDay,
  formatLumaTime,
  formatMonthYearVi,
  formatShortDate,
  formatWeekdayShortVi,
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
  eventToIcs,
} from '../data/convictionEvents'
import { loadEventsWithSource } from '../lib/convictionEventsStore'
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

function isLive(ev: SideEvent, today: string, nowHm: string): boolean {
  if (ev.dateTbd || !eventOccursOnDate(ev, today)) return false
  const start = ev.startTime || '00:00'
  const end = ev.endTime || '23:59'
  return nowHm >= start && nowHm <= end
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
  },
): string {
  const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type
  const when = ev.dateTbd
    ? `Ngày TBD · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
    : `${formatShortDate(ev.date)} · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
  const stPhase = opts.statusPhase || (opts.live ? 'live' : 'upcoming')
  const stLabel = opts.statusLabel || (opts.live ? 'LIVE' : '')
  const badges = [
    stLabel
      ? `<span class="emp__badge emp__badge--status emp__badge--status-${escapeHtml(stPhase)}">${escapeHtml(stLabel)}</span>`
      : '',
    opts.live
      ? '<span class="emp__badge emp__badge--live">Đang diễn ra</span>'
      : '',
    !opts.live && opts.today && !ev.dateTbd
      ? '<span class="emp__badge emp__badge--today">Hôm nay</span>'
      : '',
    ev.dateTbd ? '<span class="emp__badge">Ngày TBD</span>' : '',
    ev.locationTbd ? '<span class="emp__badge">Địa điểm TBD</span>' : '',
    ev.free ? '<span class="emp__badge emp__badge--free">Free</span>' : '',
    `<span class="emp__badge">${typeLabel}</span>`,
  ]
    .filter(Boolean)
    .join(' ')
  const reg = ev.link
    ? `<a href="${ev.link}" target="_blank" rel="noopener noreferrer">Đăng ký Luma</a>`
    : ''
  const directions = ev.locationTbd
    ? `<a href="${directionsUrl(SALA_VENUE.lat, SALA_VENUE.lng)}" target="_blank" rel="noopener noreferrer">Chỉ đường (venue chính)</a>`
    : `<a href="${directionsUrl(ev.lat, ev.lng)}" target="_blank" rel="noopener noreferrer">Chỉ đường</a>`
  const img = ev.imageUrl
    ? `<img class="emp-popup__img" src="${escapeHtml(toSquareImageUrl(ev.imageUrl, 640))}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
    : ''
  const dist = opts.distanceLabel
    ? `<p class="emp-popup__row emp-popup__dist">${escapeHtml(opts.distanceLabel)}</p>`
    : ''
  const placeLine = ev.locationTbd
    ? 'Địa điểm sẽ công bố sau khi duyệt (Location TBD)'
    : [ev.venue, ev.address].filter(Boolean).join(' — ')
  return `
    <div class="emp-popup__inner">
      ${img}
      <div class="emp-popup__body">
        <h3 class="emp-popup__title">${escapeHtml(ev.title)}</h3>
        <div class="emp__badges emp-popup__badges">${badges}</div>
        <p class="emp-popup__row emp-popup__when">${escapeHtml(when)}</p>
        ${dist}
        ${ev.host ? `<p class="emp-popup__row"><span class="emp-popup__k">Host</span> ${escapeHtml(ev.host)}</p>` : ''}
        <p class="emp-popup__row"><span class="emp-popup__k">Địa điểm</span> ${escapeHtml(placeLine)}</p>
        ${
          ev.locationTbd
            ? '<p class="emp-popup__row emp-popup__note">Pin tạm tại Thiskyhall Sala · tọa độ thật chưa public</p>'
            : ''
        }
        ${ev.description ? `<p class="emp-popup__desc">${escapeHtml(ev.description)}</p>` : ''}
        <div class="emp-popup__actions">
          ${directions}
          ${reg}
          <button type="button" data-ics="${escapeHtml(ev.id)}">Thêm lịch</button>
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
function buildLumaPinEl(ev: SideEvent, now: Date = new Date()): HTMLDivElement {
  const st = getSideEventStatus(ev, now)
  const root = document.createElement('div')
  root.className = [
    'emp-pin',
    ev.featured ? 'emp-pin--featured' : '',
    st.phase === 'live' ? 'emp-pin--live' : '',
    st.phase === 'ended' ? 'emp-pin--ended' : '',
    st.phase === 'upcoming' ? 'emp-pin--upcoming' : '',
  ]
    .filter(Boolean)
    .join(' ')
  root.title = `${ev.title} · ${st.detail}`
  root.dataset.eventId = ev.id

  const visual = document.createElement('div')
  visual.className = 'emp-pin__visual'

  // Status floating above pin head
  const status = document.createElement('div')
  status.className = `emp-pin__status emp-pin__status--${st.phase}`
  status.setAttribute('data-status', '1')
  status.textContent = st.pinLabel
  status.title = st.detail

  const imgWrap = document.createElement('div')
  imgWrap.className = 'emp-pin__img'
  imgWrap.style.borderColor =
    EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other

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
  label.textContent = shortEventTitle(ev.title, 26)

  visual.appendChild(status)
  visual.appendChild(imgWrap)
  visual.appendChild(label)
  root.appendChild(visual)
  return root
}

function applyPinStatus(el: HTMLElement, ev: SideEvent, now: Date) {
  const st = getSideEventStatus(ev, now)
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
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const originHubRef = useRef<Marker | null>(null)
  const venueMarkerRef = useRef<Marker | null>(null)
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
  const [query, setQuery] = useState('')
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
  const today = todayVn()
  const nowHm = nowHmVn()

  // Tick countdown chips on map pins (does not rebuild markers)
  useEffect(() => {
    if (!dataset || !mapReady) return
    const byId = new Map(dataset.events.map((e) => [e.id, e]))
    const tick = () => {
      const now = new Date()
      for (const [id, marker] of markersRef.current) {
        const ev = byId.get(id)
        if (!ev) continue
        applyPinStatus(marker.getElement(), ev, now)
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
    return formatMonthYearVi(mid)
  }, [dates])

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
    return dataset.events.filter((e) => isLive(e, today, nowHm)).length
  }, [dataset, today, nowHm])

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
      if (!matchesDateFilter(ev, dateFilter === '__default__' ? 'all' : dateFilter))
        return false
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
    query,
    sortMode,
    distanceFrom,
    today,
    nowHm,
  ])

  const distanceLabelFor = (ev: SideEvent): string | null => {
    if (ev.locationTbd) return null
    if (distOrigin === 'selected' && ev.id === selectedId) return 'Đang chọn'
    const km = eventDistanceKm(distanceFrom, ev)
    if (km == null) return null
    return formatDistanceWithDrive(km, distanceFrom.label)
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

  const grouped = useMemo(() => {
    const map = new Map<string, SideEvent[]>()
    for (const ev of filtered) {
      const key = ev.dateTbd ? 'tbd' : ev.date
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
  }, [filtered])

  const countsByDate = useMemo(() => {
    const m = new Map<string, number>()
    if (!dataset) return m
    for (const d of dates) {
      m.set(d, dataset.events.filter((e) => eventOccursOnDate(e, d)).length)
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
      venueMarkerRef.current?.remove()
      venueMarkerRef.current = null
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
    const st = getSideEventStatus(ev)
    const live = st.phase === 'live'
    const isTodayEv = eventOccursOnDate(ev, today)
    // TBD location: still show popup at main venue as approximate anchor
    const lng = ev.locationTbd
      ? (dataset?.venue.lng ?? SALA_VENUE.lng)
      : ev.lng
    const lat = ev.locationTbd
      ? (dataset?.venue.lat ?? SALA_VENUE.lat)
      : ev.lat
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
        }),
      )
      .addTo(map)
    popup.getElement()?.addEventListener('click', (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      const btn = t?.closest?.('[data-ics]') as HTMLElement | null
      if (btn) {
        e.preventDefault()
        downloadIcs(ev)
      }
    })
    popupRef.current = popup
    // Layout then pan so card is not clipped by edges / sheet
    requestAnimationFrame(() => {
      panPopupIntoView(map)
      window.setTimeout(() => panPopupIntoView(map), 320)
    })
  }

  const selectEvent = (ev: SideEvent, fly = true) => {
    setSelectedId(ev.id)
    // On mobile: peek sheet so popup has room above the list
    if (isMobileViewport()) {
      setSheetMode('peek')
    }
    const map = mapRef.current
    const target = ev.locationTbd
      ? (dataset?.venue ?? SALA_VENUE)
      : { lng: ev.lng, lat: ev.lat }
    const zoom = ev.locationTbd
      ? Math.max(map?.getZoom() ?? 13, 13.2)
      : Math.max(map?.getZoom() ?? 14, 14.4)

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

  // Sync markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !dataset) return

    if (!venueMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'emp-marker emp-marker--venue'
      el.title = dataset.venue.name
      venueMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([dataset.venue.lng, dataset.venue.lat])
        .setPopup(
          new maplibregl.Popup({
            offset: 24,
            className: 'emp-popup emp-popup--detail',
            maxWidth: '360px',
          }).setHTML(
            `<h3 class="emp-popup__title">${escapeHtml(dataset.venue.name)}</h3>
             <p class="emp-popup__row">Địa điểm chính · Conviction 2026</p>
             <p class="emp-popup__row">${escapeHtml(dataset.venue.address)}</p>
             <div class="emp-popup__actions">
               <a href="${directionsUrl(dataset.venue.lat, dataset.venue.lng)}" target="_blank" rel="noopener noreferrer">Chỉ đường</a>
               <a href="https://www.conviction.vn/vi" target="_blank" rel="noopener noreferrer">conviction.vn</a>
             </div>`,
          ),
        )
        .addTo(map)
    } else {
      venueMarkerRef.current.setLngLat([dataset.venue.lng, dataset.venue.lat])
    }

    const keep = new Set(mapEvents.map((e) => e.id))
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    const now = new Date()
    for (const ev of mapEvents) {
      const existing = markersRef.current.get(ev.id)
      const pinKey = `${ev.imageUrl || ''}|${ev.title}|${ev.type}|${ev.featured ? 1 : 0}`
      if (!existing || existing.getElement().dataset.pinKey !== pinKey) {
        existing?.remove()
        const el = buildLumaPinEl(ev, now)
        el.dataset.pinKey = pinKey
        el.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation()
          selectEvent(ev, true)
        })
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([ev.lng, ev.lat])
          .addTo(map)
        markersRef.current.set(ev.id, marker)
        el.classList.toggle('is-active', selectedId === ev.id)
      } else {
        existing.setLngLat([ev.lng, ev.lat])
        const el = existing.getElement()
        el.classList.toggle('is-active', selectedId === ev.id)
        applyPinStatus(el, ev, now)
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
          for (const ev of mapEvents) bounds.extend([ev.lng, ev.lat])
          try {
            map.fitBounds(bounds, {
              padding: {
                top: 64,
                bottom: isMobileViewport() ? 200 : 64,
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
  }, [dataset, mapEvents, mapReady, selectedId, today, nowHm])

  const setDate = (d: string) => {
    setDateFilter(d)
    setSelectedId(null)
    userMovedMapRef.current = false
    lastFitKeyRef.current = '' // force re-fit for new day filter
  }

  const cycleSheet = () => {
    setSheetMode((m) => (m === 'peek' ? 'half' : m === 'half' ? 'full' : 'peek'))
  }

  const panelClass =
    sheetMode === 'peek'
      ? 'emp__panel emp__panel--peek'
      : sheetMode === 'half'
        ? 'emp__panel emp__panel--half'
        : 'emp__panel emp__panel--full'

  return (
    <div className="emp">
      <header className="emp__header">
        <div className="emp__brand">
          <h1>Conviction 2026 · Side Events</h1>
          <p>
            TP.HCM · 13–16/08 · Thiskyhall Sala
            {liveCount > 0 ? ` · ${liveCount} đang live` : ''}
            {source !== 'server' ? ` · ${source}` : ''}
          </p>
        </div>
        <div className="emp__header-actions">
          <div className="emp__btn-group" role="group" aria-label="Đo khoảng cách">
            <button
              type="button"
              className={`emp__btn ${distOrigin === 'sala' ? 'emp__btn--primary' : ''}`}
              onClick={() => setDistOrigin('sala')}
              title="Từ Thiskyhall Sala · Conviction main venue"
            >
              Từ Conviction
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
              title="Từ vị trí của bạn"
            >
              {geoBusy ? '…' : 'Từ tôi'}
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
              title="Từ sự kiện đang chọn"
            >
              Giữa events
            </button>
          </div>
          <div className="emp__btn-group" role="group" aria-label="Sắp xếp">
            <button
              type="button"
              className={`emp__btn ${sortMode === 'upcoming' ? 'emp__btn--primary' : ''}`}
              onClick={() => setSortMode('upcoming')}
              title="Sắp diễn ra / đang live trước"
            >
              Sắp tới
            </button>
            <button
              type="button"
              className={`emp__btn ${sortMode === 'nearest' ? 'emp__btn--primary' : ''}`}
              onClick={() => setSortMode('nearest')}
              title="Gần → xa"
            >
              Gần nhất
            </button>
          </div>
          <button
            type="button"
            className="emp__btn emp-toggle-list"
            onClick={cycleSheet}
          >
            {sheetMode === 'peek'
              ? 'Mở list'
              : sheetMode === 'half'
                ? 'Mở rộng'
                : 'Thu list'}
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
      </header>

      <div className="emp__filters">
        <div className="emp-week" role="group" aria-label="Lọc theo ngày">
          <div className="emp-week__bar">
            <div className="emp-week__meta">
              <span className="emp-week__month">{calMonthLabel}</span>
              {dateFilter !== 'all' && dateFilter !== 'tbd' && dateFilter !== '__default__' ? (
                <span className="emp-week__selected-label">
                  {formatWeekdayShortVi(dateFilter)} · {formatShortDate(dateFilter)}
                  {mainForumMeta(dateFilter)
                    ? ` · ${mainForumMeta(dateFilter)!.short}`
                    : ''}
                </span>
              ) : (
                <span className="emp-week__selected-label">
                  {dateFilter === 'tbd'
                    ? 'Ngày chưa chốt'
                    : `${totalEvents} sự kiện trong tuần`}
                </span>
              )}
            </div>
            <div className="emp-week__seg" role="tablist" aria-label="Phạm vi">
              <button
                type="button"
                role="tab"
                className={`emp-week__seg-btn ${dateFilter === 'all' ? 'is-on' : ''}`}
                onClick={() => setDate('all')}
              >
                Tất cả
              </button>
            </div>
          </div>

          <div className="emp-week__days" role="listbox" aria-label="Chọn ngày">
            {dates.map((d) => {
              const count = countsByDate.get(d) || 0
              const isToday = d === today
              const isSelected = dateFilter === d
              const empty = count === 0
              const main = mainForumMeta(d)
              const isMain = Boolean(main)
              const dots = Math.min(count, 3)
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
                      ? `${main.short} · ${main.track}${count ? ` · ${count} side` : ''}`
                      : `${formatShortDate(d)} · ${count} sự kiện`
                  }
                >
                  <span className="emp-week__dow">
                    {formatWeekdayShortVi(d)}
                  </span>
                  <span className="emp-week__num">{formatDayNum(d)}</span>
                  <span className="emp-week__foot">
                    {isMain ? (
                      <span className="emp-week__main-label">
                        {main!.day === 1 ? 'Main 1' : 'Main 2'}
                      </span>
                    ) : empty ? (
                      <span className="emp-week__dots emp-week__dots--none" />
                    ) : (
                      <span className="emp-week__dots" aria-hidden>
                        {Array.from({ length: dots }).map((_, i) => (
                          <i key={i} />
                        ))}
                      </span>
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
                title="Chưa chốt ngày"
              >
                <span className="emp-week__dow">TBD</span>
                <span className="emp-week__num emp-week__num--tbd">?</span>
                <span className="emp-week__foot">
                  <span className="emp-week__main-label">{tbdDateCount}</span>
                </span>
              </button>
            )}
          </div>

          {(() => {
            const selectedMain = mainForumMeta(dateFilter)
            if (!selectedMain) return null
            return (
              <div
                className={`emp-week__main-card emp-week__main-card--d${selectedMain.day}`}
              >
                <div className="emp-week__main-left">
                  <span className="emp-week__main-badge">
                    Main · Day {selectedMain.day}
                  </span>
                  <p className="emp-week__main-title">{selectedMain.track}</p>
                  <p className="emp-week__main-sub">
                    Thiskyhall Sala · {formatShortDate(dateFilter)}
                  </p>
                </div>
                <a
                  className="emp-week__main-link"
                  href={
                    selectedMain.day === 1
                      ? 'https://www.conviction.vn/vi/day-1'
                      : 'https://www.conviction.vn/vi/day-2'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Agenda
                </a>
              </div>
            )
          })()}
        </div>

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
            Mọi loại
          </button>
          {EVENT_TYPES.filter((t) => (typeCounts.get(t) || 0) > 0).map((t) => (
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
          ))}
          <button
            type="button"
            className={`emp__chip ${freeOnly ? 'is-active' : ''}`}
            onClick={() => {
              setFreeOnly((v) => !v)
              userMovedMapRef.current = false
              lastFitKeyRef.current = ''
            }}
          >
            Chỉ Free
          </button>
          <input
            className="emp__search"
            type="search"
            placeholder="Tìm tên / host / địa điểm…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="emp__meta">
            {filtered.length} sự kiện
            {mapEvents.length < filtered.length
              ? ` · ${mapEvents.length} trên map`
              : ''}
            {sortMode === 'upcoming' ? ' · sort: sắp tới' : ''}
            {sortMode === 'nearest' ? ' · sort: gần nhất' : ''}
          </span>
        </div>
      </div>

      <div className="emp__body">
        <div className="emp__map">
          <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
          {(loading || !mapReady) && (
            <div className="emp__loading">Đang tải bản đồ…</div>
          )}
          <div className="emp__map-hint" aria-hidden>
            Chạm pin · xem chi tiết side event
          </div>
        </div>

        <aside className={panelClass}>
          <button
            type="button"
            className="emp__sheet-handle"
            onClick={cycleSheet}
            aria-label="Kéo danh sách"
          >
            <span className="emp__sheet-grip" />
          </button>
          <div className="emp__panel-head">
            <div>
              <h2>Lịch side events</h2>
              <p>
                {dateFilter === today
                  ? 'Đang lọc hôm nay · sắp tới trước'
                  : dateFilter === 'all'
                    ? 'Mọi ngày · live / sắp tới ưu tiên'
                    : `Ngày ${formatShortDate(dateFilter)}`}
                {' · '}
                khoảng cách + phút đi xe từ{' '}
                {distOrigin === 'me'
                  ? 'bạn'
                  : distOrigin === 'selected'
                    ? 'event chọn'
                    : 'Conviction'}
              </p>
            </div>
          </div>
          <div className="emp__list">
            {!filtered.length && (
              <div className="emp__empty">
                {dateFilter === today ? (
                  <>
                    Không có side event hôm nay. Thử{' '}
                    <button
                      type="button"
                      className="emp__linkish"
                      onClick={() => setDate('all')}
                    >
                      Tất cả
                    </button>{' '}
                    hoặc ngày khác.
                  </>
                ) : (
                  <>Không khớp bộ lọc. Thử “Tất cả” hoặc bỏ “Chỉ Free”.</>
                )}
              </div>
            )}
            {grouped.map(([date, list]) => (
              <div key={date} className="emp__day-group">
                <div className="emp__day-label">
                  {date === 'tbd'
                    ? 'Ngày TBD'
                    : `${formatLumaDay(date)}${date === today ? ' · Hôm nay' : ''}`}
                </div>
                {list.map((ev) => {
                  const st = getSideEventStatus(ev)
                  const live = st.phase === 'live'
                  const isTodayEv = !ev.dateTbd && eventOccursOnDate(ev, today)
                  const isActive = selectedId === ev.id
                  const timeLabel = ev.endTime
                    ? `${formatLumaTime(ev.startTime)} – ${formatLumaTime(ev.endTime)}`
                    : formatLumaTime(ev.startTime)
                  const place = ev.locationTbd
                    ? 'Địa điểm sẽ công bố sau (TBD)'
                    : ev.venue || ev.address || 'TP. Hồ Chí Minh'
                  const dist = distanceLabelFor(ev)
                  return (
                    <div
                      key={ev.id}
                      className={`emp__card emp__card--luma ${isActive ? 'is-active' : ''}${live ? ' emp__card--live' : ''}${ev.locationTbd ? ' emp__card--tbd-loc' : ''}`}
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
                            {ev.dateTbd ? 'Time TBD' : timeLabel}
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
                              Chưa có tọa độ · xem chi tiết bên dưới
                            </p>
                          ) : null}
                          <div className="emp__badges">
                            {(ev.dateTbd || ev.locationTbd) && (
                              <span className="emp__badge emp__badge--pending">
                                {ev.locationTbd
                                  ? 'Location TBD'
                                  : 'Date TBD'}
                              </span>
                            )}
                            {live && (
                              <span className="emp__badge emp__badge--live">
                                Đang diễn ra
                              </span>
                            )}
                            {!live && isTodayEv && (
                              <span className="emp__badge emp__badge--today">
                                Hôm nay
                              </span>
                            )}
                            {ev.free && (
                              <span className="emp__badge emp__badge--free">
                                Free
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
                            {st.detail}
                            {ev.locationTbd
                              ? ' · Địa điểm public sau khi duyệt Luma'
                              : ''}
                          </p>
                          <div className="emp__card-actions">
                            {ev.link ? (
                              <a
                                className="emp__card-action emp__card-action--primary"
                                href={ev.link}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Đăng ký Luma
                              </a>
                            ) : null}
                            {!ev.locationTbd ? (
                              <a
                                className="emp__card-action"
                                href={directionsUrl(ev.lat, ev.lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Chỉ đường
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
                                Venue chính
                              </a>
                            )}
                            <button
                              type="button"
                              className="emp__card-action"
                              onClick={() => downloadIcs(ev)}
                            >
                              Thêm lịch
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
