import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  SALA_VENUE,
  confirmedEventDates,
  directionsUrl,
  eventDistanceKm,
  eventOccursOnDate,
  formatDistanceWithWalk,
  formatLumaDay,
  formatLumaTime,
  formatShortDate,
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
import './EventMapPage.css'

/** Raster dark tiles — avoids CARTO vector TileJSON hangs with MapLibre v6. */
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
  opts: { live: boolean; today: boolean; distanceLabel?: string },
): string {
  const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type
  const when = ev.dateTbd
    ? `Ngày TBD · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
    : `${formatShortDate(ev.date)} · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
  const badges = [
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
    ? ''
    : `<a href="${directionsUrl(ev.lat, ev.lng)}" target="_blank" rel="noopener noreferrer">Chỉ đường</a>`
  const img = ev.imageUrl
    ? `<img class="emp-popup__img" src="${escapeHtml(toSquareImageUrl(ev.imageUrl, 320))}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
    : ''
  const dist = opts.distanceLabel
    ? `<p class="emp-popup__row emp-popup__dist">${escapeHtml(opts.distanceLabel)}</p>`
    : ''
  return `
    <div class="emp-popup__inner">
      ${img}
      <h3 class="emp-popup__title">${escapeHtml(ev.title)}</h3>
      <div class="emp__badges" style="margin:0 0 0.4rem">${badges}</div>
      <p class="emp-popup__row">${escapeHtml(when)}</p>
      ${dist}
      <p class="emp-popup__row">${escapeHtml(ev.host || '')}</p>
      <p class="emp-popup__row">${escapeHtml([ev.venue, ev.address].filter(Boolean).join(' — '))}</p>
      ${ev.description ? `<p class="emp-popup__row">${escapeHtml(ev.description)}</p>` : ''}
      <div class="emp-popup__actions">
        ${directions}
        ${reg}
        <button type="button" data-ics="${escapeHtml(ev.id)}">Thêm lịch</button>
      </div>
    </div>
  `
}

function buildLumaPinEl(ev: SideEvent, live: boolean): HTMLDivElement {
  const root = document.createElement('div')
  root.className = `emp-pin${ev.featured ? ' emp-pin--featured' : ''}${live ? ' emp-pin--live' : ''}`
  root.title = ev.title

  const imgWrap = document.createElement('div')
  imgWrap.className = 'emp-pin__img'
  imgWrap.style.borderColor = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other

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

  root.appendChild(imgWrap)
  root.appendChild(label)
  return root
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
  const venueMarkerRef = useRef<Marker | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const listRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const deepLinkApplied = useRef(false)

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
    const fromEvents = confirmedEventDates(dataset.events)
    return fromEvents.length
      ? fromEvents
      : [dataset.dateRange.start, dataset.dateRange.end].filter(Boolean)
  }, [dataset])

  const tbdDateCount = useMemo(
    () => (dataset ? dataset.events.filter((e) => e.dateTbd).length : 0),
    [dataset],
  )

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
      label: 'Sala',
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
    return formatDistanceWithWalk(km, distanceFrom.label)
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
    })
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

    const markReady = () => {
      if (cancelled || ready) return
      ready = true
      setMapReady(true)
      requestAnimationFrame(() => {
        try {
          map.resize()
        } catch {
          /* ignore */
        }
      })
    }

    map.once('load', markReady)
    map.once('idle', markReady)
    map.on('error', (e) => {
      console.warn('[EventMap] map error', e?.error || e)
      markReady()
    })
    const fallbackTimer = window.setTimeout(markReady, 2000)

    mapRef.current = map
    const markers = markersRef.current

    const onWinResize = () => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('resize', onWinResize)

    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('resize', onWinResize)
      popupRef.current?.remove()
      popupRef.current = null
      for (const m of markers.values()) m.remove()
      markers.clear()
      venueMarkerRef.current?.remove()
      venueMarkerRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  const openPopup = (ev: SideEvent) => {
    const map = mapRef.current
    if (!map || ev.locationTbd) return
    popupRef.current?.remove()
    const live = isLive(ev, today, nowHm)
    const isTodayEv = eventOccursOnDate(ev, today)
    const popup = new maplibregl.Popup({
      offset: 72,
      maxWidth: '300px',
      className: 'emp-popup',
      closeButton: true,
    })
      .setLngLat([ev.lng, ev.lat])
      .setHTML(
        popupHtml(ev, {
          live,
          today: isTodayEv,
          distanceLabel: distanceLabelFor(ev) || undefined,
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
  }

  const selectEvent = (ev: SideEvent, fly = true) => {
    setSelectedId(ev.id)
    if (isMobileViewport() && sheetMode === 'peek') setSheetMode('half')
    const map = mapRef.current
    if (map && fly && !ev.locationTbd) {
      map.flyTo({
        center: [ev.lng, ev.lat],
        zoom: Math.max(map.getZoom(), 14.4),
        speed: 1.15,
        pitch: 0,
        bearing: 0,
      })
      openPopup(ev)
    } else if (ev.locationTbd) {
      popupRef.current?.remove()
      popupRef.current = null
    } else if (map) {
      openPopup(ev)
    }
    const el = listRefs.current.get(ev.id)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

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
            offset: 18,
            className: 'emp-popup',
            maxWidth: '260px',
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

    for (const ev of mapEvents) {
      const existing = markersRef.current.get(ev.id)
      const live = isLive(ev, today, nowHm)
      const pinKey = `${ev.imageUrl || ''}|${ev.title}|${ev.type}|${ev.featured ? 1 : 0}|${live ? 1 : 0}`
      if (!existing || existing.getElement().dataset.pinKey !== pinKey) {
        existing?.remove()
        const el = buildLumaPinEl(ev, live)
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
        existing.getElement().classList.toggle('is-active', selectedId === ev.id)
      }
    }

    if (!selectedId && mapEvents.length) {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([dataset.venue.lng, dataset.venue.lat])
      for (const ev of mapEvents) bounds.extend([ev.lng, ev.lat])
      try {
        map.fitBounds(bounds, {
          padding: { top: 64, bottom: isMobileViewport() ? 220 : 64, left: 40, right: 40 },
          maxZoom: 14.2,
          duration: 650,
          pitch: 0,
          bearing: 0,
        })
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, mapEvents, mapReady, selectedId, today, nowHm])

  const setDate = (d: string) => {
    setDateFilter(d)
    setSelectedId(null)
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
              title="Từ Thiskyhall Sala"
            >
              Từ Sala
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
            className="emp__btn"
            href="https://www.conviction.vn/vi"
            target="_blank"
            rel="noopener noreferrer"
          >
            conviction.vn
          </a>
          <a className="emp__btn emp__btn--primary" href="#/">
            ← Radar
          </a>
        </div>
      </header>

      <div className="emp__filters">
        <div className="emp__filter-row">
          <button
            type="button"
            className={`emp__chip ${dateFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setDate('all')}
          >
            Tất cả ({dataset?.events.length ?? 0})
          </button>
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              className={`emp__chip ${dateFilter === d ? 'is-active is-active--gold' : ''}`}
              onClick={() => setDate(d)}
            >
              {formatShortDate(d)} ({countsByDate.get(d) || 0})
              {d === today ? ' · hôm nay' : ''}
            </button>
          ))}
          {tbdDateCount > 0 && (
            <button
              type="button"
              className={`emp__chip ${dateFilter === 'tbd' ? 'is-active' : ''}`}
              onClick={() => setDate('tbd')}
            >
              Ngày TBD ({tbdDateCount})
            </button>
          )}
        </div>
        <div className="emp__filter-row">
          <button
            type="button"
            className={`emp__chip ${typeFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            Mọi loại
          </button>
          {EVENT_TYPES.filter((t) => (typeCounts.get(t) || 0) > 0).map((t) => (
            <button
              key={t}
              type="button"
              className={`emp__chip ${typeFilter === t ? 'is-active' : ''}`}
              onClick={() => setTypeFilter(t)}
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
            onClick={() => setFreeOnly((v) => !v)}
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
            Pin vàng = Thiskyhall Sala · Click pin / list để chỉ đường
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
                khoảng cách + phút đi bộ từ{' '}
                {distOrigin === 'me'
                  ? 'bạn'
                  : distOrigin === 'selected'
                    ? 'event chọn'
                    : 'Sala'}
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
                  const live = isLive(ev, today, nowHm)
                  const isTodayEv = !ev.dateTbd && eventOccursOnDate(ev, today)
                  const timeLabel = ev.endTime
                    ? `${formatLumaTime(ev.startTime)} – ${formatLumaTime(ev.endTime)}`
                    : formatLumaTime(ev.startTime)
                  const place = ev.locationTbd
                    ? 'Location Shown Upon Approval'
                    : ev.venue || ev.address || 'TP. Hồ Chí Minh'
                  const dist = distanceLabelFor(ev)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`emp__card emp__card--luma ${selectedId === ev.id ? 'is-active' : ''}${live ? ' emp__card--live' : ''}`}
                      ref={(node) => {
                        if (node) listRefs.current.set(ev.id, node)
                        else listRefs.current.delete(ev.id)
                      }}
                      onClick={() => selectEvent(ev, true)}
                    >
                      <div className="emp__card-body">
                        <p className="emp__card-time">
                          {ev.dateTbd ? 'Time TBD' : timeLabel}
                          {live ? ' · LIVE' : ''}
                        </p>
                        <p className="emp__card-title">{ev.title}</p>
                        {ev.host ? (
                          <p className="emp__card-host">
                            <span className="emp__card-host-dot" aria-hidden />
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
                            Chưa có tọa độ
                          </p>
                        ) : null}
                        <div className="emp__badges">
                          {(ev.dateTbd || ev.locationTbd) && (
                            <span className="emp__badge emp__badge--pending">
                              Pending
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
