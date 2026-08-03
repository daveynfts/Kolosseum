import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  datesInRange,
  directionsUrl,
  eventOccursOnDate,
  eventToIcs,
  formatShortDate,
  sortEvents,
  type SideEvent,
  type SideEventDataset,
  type SideEventType,
} from '../data/convictionEvents'
import { loadEventsWithSource } from '../lib/convictionEventsStore'
import './EventMapPage.css'

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const HCMC_BOUNDS: [[number, number], [number, number]] = [
  [106.35, 10.35],
  [107.05, 11.05],
]

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
  if (!eventOccursOnDate(ev, today)) return false
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
  const when = `${formatShortDate(ev.date)} · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}`
  const badges = [
    opts.live ? '<span class="emp__badge emp__badge--live">Đang diễn ra</span>' : '',
    !opts.live && opts.today
      ? '<span class="emp__badge emp__badge--today">Hôm nay</span>'
      : '',
    ev.free ? '<span class="emp__badge emp__badge--free">Free</span>' : '',
    `<span class="emp__badge">${typeLabel}</span>`,
  ]
    .filter(Boolean)
    .join(' ')
  const reg = ev.link
    ? `<a href="${ev.link}" target="_blank" rel="noopener noreferrer">Đăng ký</a>`
    : ''
  return `
    <div class="emp-popup__inner">
      <h3 class="emp-popup__title">${escapeHtml(ev.title)}</h3>
      <div class="emp__badges" style="margin:0 0 0.4rem">${badges}</div>
      <p class="emp-popup__row">${escapeHtml(when)}</p>
      <p class="emp-popup__row">${escapeHtml(ev.host || '')}</p>
      <p class="emp-popup__row">${escapeHtml([ev.venue, ev.address].filter(Boolean).join(' — '))}</p>
      ${ev.description ? `<p class="emp-popup__row">${escapeHtml(ev.description)}</p>` : ''}
      <div class="emp-popup__actions">
        <a href="${directionsUrl(ev.lat, ev.lng)}" target="_blank" rel="noopener noreferrer">Chỉ đường</a>
        ${reg}
        <button type="button" data-ics="${escapeHtml(ev.id)}">Thêm lịch</button>
      </div>
    </div>
  `
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
    return datesInRange(dataset.dateRange.start, dataset.dateRange.end)
  }, [dataset])

  const filtered = useMemo(() => {
    if (!dataset) return []
    const q = query.trim().toLowerCase()
    return sortEvents(
      dataset.events.filter((ev) => {
        if (dateFilter !== 'all' && !eventOccursOnDate(ev, dateFilter)) return false
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

  const grouped = useMemo(() => {
    const map = new Map<string, SideEvent[]>()
    for (const ev of filtered) {
      const list = map.get(ev.date) || []
      list.push(ev)
      map.set(ev.date, list)
    }
    return [...map.entries()]
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
    if (!mapEl.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: STYLE_URL,
      center: [106.7204, 10.7269],
      zoom: 12,
      maxBounds: HCMC_BOUNDS,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right',
    )
    map.on('load', () => setMapReady(true))
    mapRef.current = map
    const markers = markersRef.current
    return () => {
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
      offset: 18,
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
    if (map && fly) {
      map.flyTo({ center: [ev.lng, ev.lat], zoom: Math.max(map.getZoom(), 14), speed: 1.1 })
    }
    openPopup(ev)
    const el = listRefs.current.get(ev.id)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

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

    const keep = new Set(filtered.map((e) => e.id))
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    for (const ev of filtered) {
      const existing = markersRef.current.get(ev.id)
      if (!existing) {
        const el = document.createElement('div')
        el.className = `emp-marker${ev.featured ? ' emp-marker--featured' : ''}`
        el.style.background = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other
        el.title = ev.title
        el.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation()
          selectEvent(ev, true)
        })
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ev.lng, ev.lat])
          .addTo(map)
        markersRef.current.set(ev.id, marker)
        marker.getElement().classList.toggle('is-active', selectedId === ev.id)
      } else {
        existing.setLngLat([ev.lng, ev.lat])
        const el = existing.getElement()
        el.style.background = EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other
        el.classList.toggle('emp-marker--featured', !!ev.featured)
        el.classList.toggle('is-active', selectedId === ev.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectEvent closes over latest; markers sync on filter/selection
  }, [dataset, filtered, mapReady, selectedId])

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
            Tất cả ngày
          </button>
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              className={`emp__chip ${dateFilter === d ? 'is-active is-active--gold' : ''}`}
              onClick={() => setDateFilter(d)}
            >
              {formatShortDate(d)}
              {countsByDate.get(d) ? ` (${countsByDate.get(d)})` : ''}
              {d === today ? ' · hôm nay' : ''}
            </button>
          ))}
        </div>
        <div className="emp__filter-row">
          <button
            type="button"
            className={`emp__chip ${typeFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            Mọi loại
          </button>
          {EVENT_TYPES.map((t) => (
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
              {EVENT_TYPE_LABELS[t]}
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
          <span className="emp__meta">{filtered.length} sự kiện</span>
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
            <p>Chạm để mở popup trên map · Chỉ đường / Đăng ký / .ics</p>
          </div>
          <div className="emp__list">
            {!filtered.length && (
              <div className="emp__empty">
                Không có sự kiện khớp bộ lọc. Thử đổi ngày hoặc bỏ “Chỉ Free”.
              </div>
            )}
            {grouped.map(([date, list]) => (
              <div key={date}>
                <div className="emp__day-label">
                  {formatShortDate(date)}
                  {date === today ? ' · Hôm nay' : ''}
                </div>
                {list.map((ev) => {
                  const live = isLive(ev, today, nowHm)
                  const isToday = eventOccursOnDate(ev, today)
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
                        <span
                          className="emp__dot"
                          style={{ background: EVENT_TYPE_COLORS[ev.type] }}
                        />
                        <div>
                          <p className="emp__card-title">{ev.title}</p>
                          <p className="emp__card-meta">
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
