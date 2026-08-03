import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  Popup,
  StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  SALA_VENUE,
  confirmedEventDates,
  directionsUrl,
  eventOccursOnDate,
  eventToIcs,
  formatShortDate,
  matchesDateFilter,
  shortEventTitle,
  sortEvents,
  toSquareImageUrl,
  type SideEvent,
  type SideEventDataset,
  type SideEventType,
} from '../data/convictionEvents'
import { loadEventsWithSource } from '../lib/convictionEventsStore'
import './EventMapPage.css'

/** Raster dark tiles — avoids CARTO vector TileJSON hangs with MapLibre v6. */
const MAP_STYLE: StyleSpecification = {
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

/** Approx. Thiskyhall Sala footprint for gold 3D highlight (not survey-accurate). */
function salaFootprint(lng: number, lat: number) {
  // ~90m × 140m rectangle
  const dLng = 0.00042
  const dLat = 0.00062
  return [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ]
}

function addVenue3dLayers(map: MapLibreMap, venue: { lng: number; lat: number; name: string }) {
  if (!map.getSource('ofm-buildings')) {
    map.addSource('ofm-buildings', {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap',
    })
  }

  if (!map.getLayer('hcmc-3d-buildings')) {
    map.addLayer({
      id: 'hcmc-3d-buildings',
      source: 'ofm-buildings',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14,
      filter: ['!', ['has', 'hide_3d']],
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'render_height'], ['get', 'height'], 16],
          0,
          '#1e293b',
          20,
          '#334155',
          60,
          '#475569',
        ],
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          14.8,
          [
            'coalesce',
            ['get', 'render_height'],
            ['get', 'height'],
            ['*', ['coalesce', ['get', 'levels'], 3], 3.2],
            14,
          ],
        ],
        'fill-extrusion-base': [
          'coalesce',
          ['get', 'render_min_height'],
          ['get', 'min_height'],
          0,
        ],
        'fill-extrusion-opacity': 0.78,
      },
    })
  }

  const footprint = {
    type: 'Feature' as const,
    properties: {
      name: venue.name,
      height: 48,
      base: 0,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: salaFootprint(venue.lng, venue.lat),
    },
  }

  const existing = map.getSource('main-venue-3d') as GeoJSONSource | undefined
  if (existing) {
    existing.setData({ type: 'FeatureCollection', features: [footprint] })
  } else {
    map.addSource('main-venue-3d', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [footprint] },
    })
  }

  if (!map.getLayer('main-venue-3d-extrusion')) {
    map.addLayer({
      id: 'main-venue-3d-extrusion',
      type: 'fill-extrusion',
      source: 'main-venue-3d',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#fbbf24',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true,
      },
    })
  }

  if (!map.getLayer('main-venue-3d-outline')) {
    map.addLayer({
      id: 'main-venue-3d-outline',
      type: 'line',
      source: 'main-venue-3d',
      minzoom: 13,
      paint: {
        'line-color': '#fde68a',
        'line-width': 2,
        'line-opacity': 0.9,
      },
    })
  }
}

function setMap3dCamera(
  map: MapLibreMap,
  enabled: boolean,
  center: [number, number],
) {
  if (enabled) {
    map.easeTo({
      center,
      zoom: Math.max(map.getZoom(), 15.6),
      pitch: 58,
      bearing: -28,
      duration: 900,
    })
  } else {
    map.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 700,
    })
  }
}

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

function downloadIcs(ev: SideEvent) {
  const blob = new Blob([eventToIcs(ev)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function popupHtml(ev: SideEvent, opts: { live: boolean; today: boolean }): string {
  const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type
  const when = ev.dateTbd
    ? `Ngày TBD · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
    : `${formatShortDate(ev.date)} · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
  const badges = [
    opts.live ? '<span class="emp__badge emp__badge--live">Đang diễn ra</span>' : '',
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
  return `
    <div class="emp-popup__inner">
      ${img}
      <h3 class="emp-popup__title">${escapeHtml(ev.title)}</h3>
      <div class="emp__badges" style="margin:0 0 0.4rem">${badges}</div>
      <p class="emp-popup__row">${escapeHtml(when)}</p>
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

function buildLumaPinEl(ev: SideEvent): HTMLDivElement {
  const root = document.createElement('div')
  root.className = `emp-pin${ev.featured ? ' emp-pin--featured' : ''}`
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

export function EventMapPage() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const venueMarkerRef = useRef<Marker | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const listRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const [dataset, setDataset] = useState<SideEventDataset | null>(null)
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<SideEventType | 'all'>('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [view3d, setView3d] = useState(true)
  const view3dRef = useRef(true)
  const venueRef = useRef({
    lng: SALA_VENUE.lng,
    lat: SALA_VENUE.lat,
    name: SALA_VENUE.name,
  })

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

  const filtered = useMemo(() => {
    if (!dataset) return []
    const q = query.trim().toLowerCase()
    return sortEvents(
      dataset.events.filter((ev) => {
        if (!matchesDateFilter(ev, dateFilter)) return false
        if (typeFilter !== 'all' && ev.type !== typeFilter) return false
        if (freeOnly && !ev.free) return false
        if (q) {
          const hay = `${ev.title} ${ev.host} ${ev.venue} ${ev.address}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      }),
    )
  }, [dataset, dateFilter, typeFilter, freeOnly, query])

  /** Only pin events with a public venue — never fake TBD locations. */
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

  // Init map
  useEffect(() => {
    const container = mapEl.current
    if (!container) return

    let cancelled = false
    let ready = false
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [SALA_VENUE.lng, SALA_VENUE.lat],
      zoom: 12.4,
      pitch: 48,
      bearing: -20,
      maxPitch: 70,
      maxBounds: HCMC_BOUNDS,
      attributionControl: { compact: true },
    })
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: true,
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

    const setup3d = () => {
      if (cancelled) return
      try {
        addVenue3dLayers(map, venueRef.current)
      } catch (err) {
        console.warn('[EventMap] 3D buildings unavailable', err)
      }
    }

    const markReady = () => {
      if (cancelled || ready) return
      ready = true
      setMapReady(true)
      setup3d()
      // Container may have been 0-height during init (flex layout).
      requestAnimationFrame(() => {
        try {
          map.resize()
          if (view3dRef.current) {
            setMap3dCamera(map, true, [
              venueRef.current.lng,
              venueRef.current.lat,
            ])
          }
        } catch {
          /* ignore */
        }
      })
    }

    map.once('load', markReady)
    map.once('idle', markReady)
    map.on('error', (e) => {
      console.warn('[EventMap] map error', e?.error || e)
      // Still unblock UI so markers/list interaction work.
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
    if (!map) return
    popupRef.current?.remove()
    const live = isLive(ev, today, nowHm)
    const isToday = eventOccursOnDate(ev, today)
    const popup = new maplibregl.Popup({
      offset: 72,
      maxWidth: '300px',
      className: 'emp-popup',
      closeButton: true,
    })
      .setLngLat([ev.lng, ev.lat])
      .setHTML(popupHtml(ev, { live, today: isToday }))
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
    const map = mapRef.current
    if (map && fly && !ev.locationTbd) {
      map.flyTo({
        center: [ev.lng, ev.lat],
        zoom: Math.max(map.getZoom(), 14.2),
        speed: 1.1,
        pitch: view3dRef.current ? 52 : 0,
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

  // Keep venue 3D footprint in sync with admin dataset
  useEffect(() => {
    if (!dataset) return
    venueRef.current = {
      lng: dataset.venue.lng,
      lat: dataset.venue.lat,
      name: dataset.venue.name,
    }
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      addVenue3dLayers(map, venueRef.current)
    } catch {
      /* ignore */
    }
  }, [dataset, mapReady])

  // Sync markers with filtered events
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !dataset) return

    // Venue marker
    if (!venueMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'emp-marker emp-marker--venue'
      el.title = dataset.venue.name
      venueMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([dataset.venue.lng, dataset.venue.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 18, className: 'emp-popup', maxWidth: '260px' }).setHTML(
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
      const pinKey = `${ev.imageUrl || ''}|${ev.title}|${ev.type}|${ev.featured ? 1 : 0}`
      if (!existing || existing.getElement().dataset.pinKey !== pinKey) {
        existing?.remove()
        const el = buildLumaPinEl(ev)
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

    // Fit map to visible confirmed pins + main venue (skip while a pin is selected).
    if (!selectedId && mapEvents.length) {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([dataset.venue.lng, dataset.venue.lat])
      for (const ev of mapEvents) bounds.extend([ev.lng, ev.lat])
      try {
        map.fitBounds(bounds, {
          padding: { top: 72, bottom: 72, left: 48, right: 48 },
          maxZoom: 14.2,
          duration: 700,
          pitch: view3dRef.current ? 48 : 0,
        })
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectEvent closes over latest; markers sync on filter/selection
  }, [dataset, mapEvents, mapReady, selectedId])

  return (
    <div className="emp">
      <header className="emp__header">
        <div className="emp__brand">
          <h1>Conviction 2026 — Side Events Map</h1>
          <p>
            TP. Hồ Chí Minh · 13–16/08/2026 · Thiskyhall Sala
            {source !== 'server' ? ` · data: ${source}` : ''}
          </p>
        </div>
        <div className="emp__header-actions">
          <button
            type="button"
            className={`emp__btn ${view3d ? 'emp__btn--primary' : ''}`}
            onClick={() => {
              const next = !view3d
              setView3d(next)
              view3dRef.current = next
              const map = mapRef.current
              if (!map) return
              setMap3dCamera(map, next, [
                venueRef.current.lng,
                venueRef.current.lat,
              ])
            }}
            title="Bật/tắt góc nhìn 3D quanh Thiskyhall Sala"
          >
            {view3d ? '3D · Sala' : '2D'}
          </button>
          <button
            type="button"
            className="emp__btn emp-toggle-list"
            onClick={() => setListOpen((v) => !v)}
          >
            {listOpen ? 'Ẩn danh sách' : 'Hiện danh sách'}
          </button>
          <a
            className="emp__btn"
            href="https://www.conviction.vn/vi"
            target="_blank"
            rel="noopener noreferrer"
          >
            conviction.vn
          </a>
          <a className="emp__btn emp__btn--primary" href="#/">
            ← KOL Radar
          </a>
        </div>
      </header>

      <div className="emp__filters">
        <div className="emp__filter-row">
          <button
            type="button"
            className={`emp__chip ${dateFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setDateFilter('all')}
          >
            Tất cả ({dataset?.events.length ?? 0})
          </button>
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              className={`emp__chip ${dateFilter === d ? 'is-active is-active--gold' : ''}`}
              onClick={() => setDateFilter(d)}
            >
              {formatShortDate(d)} ({countsByDate.get(d) || 0})
              {d === today ? ' · hôm nay' : ''}
            </button>
          ))}
          {tbdDateCount > 0 && (
            <button
              type="button"
              className={`emp__chip ${dateFilter === 'tbd' ? 'is-active' : ''}`}
              onClick={() => setDateFilter('tbd')}
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
          </span>
        </div>
      </div>

      <div className="emp__body">
        <div className="emp__map">
          <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
          {(loading || !mapReady) && (
            <div className="emp__loading">Đang tải bản đồ…</div>
          )}
        </div>

        <aside className={`emp__panel ${listOpen ? '' : 'is-collapsed'}`}>
          <div className="emp__panel-head">
            <h2>Lịch side events</h2>
            <p>
              Luma calendar · sự kiện chưa có địa điểm chỉ hiện trong list (không
              pin giả trên map)
            </p>
          </div>
          <div className="emp__list">
            {!filtered.length && (
              <div className="emp__empty">
                Không có sự kiện khớp bộ lọc. Thử “Tất cả” hoặc bỏ “Chỉ Free”.
              </div>
            )}
            {grouped.map(([date, list]) => (
              <div key={date}>
                <div className="emp__day-label">
                  {date === 'tbd'
                    ? 'Ngày TBD'
                    : `${formatShortDate(date)}${date === today ? ' · Hôm nay' : ''}`}
                </div>
                {list.map((ev) => {
                  const live = isLive(ev, today, nowHm)
                  const isToday = !ev.dateTbd && eventOccursOnDate(ev, today)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`emp__card ${selectedId === ev.id ? 'is-active' : ''}`}
                      ref={(node) => {
                        if (node) listRefs.current.set(ev.id, node)
                        else listRefs.current.delete(ev.id)
                      }}
                      onClick={() => selectEvent(ev, true)}
                    >
                      <div className="emp__card-top">
                        {ev.imageUrl ? (
                          <img
                            className="emp__thumb"
                            src={toSquareImageUrl(ev.imageUrl, 96)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span
                            className="emp__dot"
                            style={{ background: EVENT_TYPE_COLORS[ev.type] }}
                          />
                        )}
                        <div>
                          <p className="emp__card-title">{ev.title}</p>
                          <p className="emp__card-meta">
                            {ev.dateTbd ? 'Ngày TBD' : formatShortDate(ev.date)}
                            {' · '}
                            {ev.startTime}
                            {ev.endTime ? `–${ev.endTime}` : ''}
                            {ev.host ? ` · ${ev.host}` : ''}
                            {ev.venue ? ` · ${ev.venue}` : ''}
                          </p>
                          <div className="emp__badges">
                            {live && (
                              <span className="emp__badge emp__badge--live">
                                Đang diễn ra
                              </span>
                            )}
                            {!live && isToday && (
                              <span className="emp__badge emp__badge--today">
                                Hôm nay
                              </span>
                            )}
                            {ev.locationTbd && (
                              <span className="emp__badge">Địa điểm TBD</span>
                            )}
                            {ev.free && (
                              <span className="emp__badge emp__badge--free">Free</span>
                            )}
                            <span className="emp__badge">
                              {EVENT_TYPE_LABELS[ev.type]}
                            </span>
                          </div>
                        </div>
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
