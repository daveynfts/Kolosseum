/**
 * Admin: Conviction 2026 side events — CRUD → Save R2 for public map.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  SALA_VENUE,
  createEmptySideEvent,
  directionsUrl,
  formatShortDate,
  sortEvents,
  type SideEvent,
  type SideEventDataset,
  type SideEventType,
} from '../data/convictionEvents'
import {
  clearEventsCache,
  exportEventsJson,
  importEventsJson,
  loadEventsWithSource,
  saveEventsToServer,
  seedConvictionEvents,
} from '../lib/convictionEventsStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'

interface Props {
  onToast: (msg: string) => void
}

async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; display: string } | null> {
  const q = `${address}, Ho Chi Minh City, Vietnam`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi',
    },
  })
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name?: string
  }>
  const hit = rows[0]
  if (!hit) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, display: hit.display_name || address }
}

export function AdminConvictionEventsEditor({ onToast }: Props) {
  const [dataset, setDataset] = useState<SideEventDataset>(() =>
    seedConvictionEvents(),
  )
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listQuery, setListQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadEventsWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
      setSource(r.source)
      if (!selectedId && r.dataset.events[0]) {
        setSelectedId(r.dataset.events[0].id)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(
    () => sortEvents(dataset.events),
    [dataset.events],
  )

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((e) =>
      `${e.title} ${e.host} ${e.venue} ${e.date}`.toLowerCase().includes(q),
    )
  }, [sorted, listQuery])

  const selected = useMemo(
    () => dataset.events.find((e) => e.id === selectedId) || null,
    [dataset.events, selectedId],
  )

  const patchMeta = (
    patch: Partial<
      Pick<SideEventDataset, 'title' | 'note' | 'dateRange' | 'venue'>
    >,
  ) => {
    setDataset((prev) => ({
      ...prev,
      ...patch,
      venue: patch.venue ? { ...prev.venue, ...patch.venue } : prev.venue,
      dateRange: patch.dateRange
        ? { ...prev.dateRange, ...patch.dateRange }
        : prev.dateRange,
    }))
    setDirty(true)
  }

  const patchEvent = (id: string, patch: Partial<SideEvent>) => {
    setDataset((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
    setDirty(true)
  }

  const onAdd = () => {
    const ev = createEmptySideEvent({
      date: dataset.dateRange.start,
      lat: dataset.venue.lat,
      lng: dataset.venue.lng,
      venue: dataset.venue.name,
      address: dataset.venue.address,
    })
    setDataset((prev) => ({ ...prev, events: [...prev.events, ev] }))
    setSelectedId(ev.id)
    setDirty(true)
    onToast('Đã thêm event mới — điền form rồi Save (R2)')
  }

  const onClone = (ev: SideEvent) => {
    const clone = createEmptySideEvent({
      ...ev,
      id: undefined,
      title: `${ev.title} (copy)`,
      featured: false,
    })
    setDataset((prev) => ({ ...prev, events: [...prev.events, clone] }))
    setSelectedId(clone.id)
    setDirty(true)
    onToast('Đã clone — chỉnh ngày/giờ rồi Save')
  }

  const onDelete = (id: string) => {
    if (!confirm('Xoá side event này?')) return
    setDataset((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }))
    setSelectedId((cur) => (cur === id ? null : cur))
    setDirty(true)
  }

  const onSave = async () => {
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      onToast('Nhập FEED_ADMIN_TOKEN rồi Save (R2)')
      return
    }
    for (const e of dataset.events) {
      if (!e.title.trim()) {
        onToast(`Event ${e.id}: thiếu title`)
        setSelectedId(e.id)
        return
      }
      if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        onToast(`Event ${e.id}: date phải YYYY-MM-DD`)
        setSelectedId(e.id)
        return
      }
    }
    setAdminToken(token)
    setTokenInput(token)
    setSaving(true)
    const result = await saveEventsToServer(dataset, token)
    setSaving(false)
    if (!result.ok) {
      onToast(`Publish thất bại: ${result.error}`)
      return
    }
    setDataset(result.dataset)
    setSource('server')
    setDirty(false)
    onToast(`Đã publish ${result.dataset.events.length} events → R2`)
  }

  const onReload = () => {
    void loadEventsWithSource().then((r) => {
      setDataset(r.dataset)
      setSource(r.source)
      setDirty(false)
      onToast(`Reloaded from ${r.source}`)
    })
  }

  const onResetSeed = () => {
    if (!confirm('Reset về seed mẫu trong repo?')) return
    clearEventsCache()
    const seed = seedConvictionEvents()
    setDataset(seed)
    setSource('seed')
    setSelectedId(seed.events[0]?.id ?? null)
    setDirty(true)
    onToast('Seed loaded — Save (R2) để publish')
  }

  const onExport = () => {
    const blob = new Blob([exportEventsJson(dataset)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `conviction-events-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast('Exported JSON')
  }

  const onImport = async (file: File) => {
    try {
      const imported = importEventsJson(await file.text())
      setDataset(imported)
      setSource('seed')
      setSelectedId(imported.events[0]?.id ?? null)
      setDirty(true)
      onToast(`Imported ${imported.events.length} events`)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const onGeocode = async () => {
    if (!selected) return
    const addr = selected.address || selected.venue
    if (!addr.trim()) {
      onToast('Nhập address hoặc venue trước')
      return
    }
    setGeocoding(true)
    try {
      const hit = await geocodeAddress(addr)
      if (!hit) {
        onToast('Không tìm thấy tọa độ — thử địa chỉ cụ thể hơn')
        return
      }
      patchEvent(selected.id, { lat: hit.lat, lng: hit.lng })
      onToast(`Tọa độ: ${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}`)
    } catch (e) {
      onToast(`Geocode lỗi: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <div className="admin-feed admin-events-page">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>Conviction 2026 · Side Events</strong>
        <span>
          Public map:{' '}
          <a href="/event/conviction-2026" target="_blank" rel="noreferrer">
            /event/conviction-2026
          </a>{' '}
          · Source: <strong>{source}</strong>
          {dirty ? ' · unsaved' : ''} · R2{' '}
          <code>events/conviction-2026/v1.json</code>
        </span>
      </div>

      <div className="admin-feed-toolbar glass">
        <label className="admin-gate__row" style={{ margin: 0, flex: '1 1 200px' }}>
          FEED_ADMIN_TOKEN
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="token"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          disabled={saving}
          onClick={() => void onSave()}
        >
          {saving ? 'Saving…' : 'Save (R2)'}
        </button>
        <button type="button" className="btn" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="btn" onClick={onResetSeed}>
          Reset seed
        </button>
        <button type="button" className="btn" onClick={onExport}>
          Export JSON
        </button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
        </label>
        <a className="btn" href="/event/conviction-2026" target="_blank" rel="noreferrer">
          Open map ↗
        </a>
      </div>

      <div className="admin-events-meta glass">
        <h3>Thông tin sự kiện chính</h3>
        <div className="admin-events-grid">
          <label>
            Title
            <input
              value={dataset.title}
              onChange={(e) => patchMeta({ title: e.target.value })}
            />
          </label>
          <label>
            Venue name
            <input
              value={dataset.venue.name}
              onChange={(e) =>
                patchMeta({ venue: { ...dataset.venue, name: e.target.value } })
              }
            />
          </label>
          <label className="admin-events-span2">
            Venue address
            <input
              value={dataset.venue.address}
              onChange={(e) =>
                patchMeta({
                  venue: { ...dataset.venue, address: e.target.value },
                })
              }
            />
          </label>
          <label>
            Venue lat
            <input
              type="number"
              step="any"
              value={dataset.venue.lat}
              onChange={(e) =>
                patchMeta({
                  venue: {
                    ...dataset.venue,
                    lat: Number(e.target.value) || SALA_VENUE.lat,
                  },
                })
              }
            />
          </label>
          <label>
            Venue lng
            <input
              type="number"
              step="any"
              value={dataset.venue.lng}
              onChange={(e) =>
                patchMeta({
                  venue: {
                    ...dataset.venue,
                    lng: Number(e.target.value) || SALA_VENUE.lng,
                  },
                })
              }
            />
          </label>
          <label>
            Date range start
            <input
              type="date"
              value={dataset.dateRange.start}
              onChange={(e) =>
                patchMeta({
                  dateRange: { ...dataset.dateRange, start: e.target.value },
                })
              }
            />
          </label>
          <label>
            Date range end
            <input
              type="date"
              value={dataset.dateRange.end}
              onChange={(e) =>
                patchMeta({
                  dateRange: { ...dataset.dateRange, end: e.target.value },
                })
              }
            />
          </label>
          <label className="admin-events-span2">
            Note (nội bộ)
            <input
              value={dataset.note || ''}
              onChange={(e) => patchMeta({ note: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="admin-events-layout">
        <div className="admin-events-list glass">
          <div className="admin-events-list__head">
            <strong>Events ({dataset.events.length})</strong>
            <button type="button" className="btn btn--primary" onClick={onAdd}>
              + Thêm
            </button>
          </div>
          <input
            className="admin-search"
            type="search"
            placeholder="Lọc list…"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div className="admin-events-list__scroll">
            {filtered.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`admin-events-row ${selectedId === ev.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(ev.id)}
              >
                <span className="admin-events-row__date">
                  {formatShortDate(ev.date)} {ev.startTime}
                </span>
                <span className="admin-events-row__title">{ev.title || '(no title)'}</span>
                <span className="admin-events-row__meta">
                  {EVENT_TYPE_LABELS[ev.type]}
                  {ev.free ? ' · Free' : ''}
                  {ev.featured ? ' · ★' : ''}
                  {ev.venue ? ` · ${ev.venue}` : ''}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="admin-events-empty">Chưa có event — bấm + Thêm</p>
            )}
          </div>
        </div>

        <div className="admin-events-form glass">
          {!selected ? (
            <p className="admin-events-empty">Chọn event bên trái hoặc + Thêm</p>
          ) : (
            <>
              <div className="admin-events-form__head">
                <h3>Edit event</h3>
                <div className="admin-events-form__actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onClone(selected)}
                  >
                    Clone
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onDelete(selected.id)}
                  >
                    Xoá
                  </button>
                </div>
              </div>
              <div className="admin-events-grid">
                <label className="admin-events-span2">
                  Title *
                  <input
                    value={selected.title}
                    onChange={(e) =>
                      patchEvent(selected.id, { title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Host
                  <input
                    value={selected.host}
                    onChange={(e) =>
                      patchEvent(selected.id, { host: e.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={selected.type}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        type: e.target.value as SideEventType,
                      })
                    }
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date *
                  <input
                    type="date"
                    value={selected.date}
                    onChange={(e) =>
                      patchEvent(selected.id, { date: e.target.value })
                    }
                  />
                </label>
                <label>
                  End date (multi-day)
                  <input
                    type="date"
                    value={selected.endDate || ''}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        endDate: e.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Start time
                  <input
                    type="time"
                    value={selected.startTime}
                    onChange={(e) =>
                      patchEvent(selected.id, { startTime: e.target.value })
                    }
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    value={selected.endTime || ''}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        endTime: e.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Venue
                  <input
                    value={selected.venue}
                    onChange={(e) =>
                      patchEvent(selected.id, { venue: e.target.value })
                    }
                  />
                </label>
                <label className="admin-events-span2">
                  Address
                  <input
                    value={selected.address}
                    onChange={(e) =>
                      patchEvent(selected.id, { address: e.target.value })
                    }
                  />
                </label>
                <label>
                  Lat *
                  <input
                    type="number"
                    step="any"
                    value={selected.lat}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        lat: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label>
                  Lng *
                  <input
                    type="number"
                    step="any"
                    value={selected.lng}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        lng: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <div className="admin-events-span2 admin-events-geo">
                  <button
                    type="button"
                    className="btn"
                    disabled={geocoding}
                    onClick={() => void onGeocode()}
                  >
                    {geocoding ? 'Đang tra…' : 'Tra tọa độ từ địa chỉ (Nominatim)'}
                  </button>
                  <a
                    className="btn"
                    href={directionsUrl(selected.lat, selected.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Xem trên Google Maps ↗
                  </a>
                </div>
                <label className="admin-events-span2">
                  Registration link
                  <input
                    value={selected.link || ''}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        link: e.target.value || undefined,
                      })
                    }
                    placeholder="https://"
                  />
                </label>
                <label className="admin-events-span2">
                  Description
                  <textarea
                    rows={3}
                    value={selected.description || ''}
                    onChange={(e) =>
                      patchEvent(selected.id, {
                        description: e.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label className="admin-events-check">
                  <input
                    type="checkbox"
                    checked={!!selected.free}
                    onChange={(e) =>
                      patchEvent(selected.id, { free: e.target.checked })
                    }
                  />
                  Free
                </label>
                <label className="admin-events-check">
                  <input
                    type="checkbox"
                    checked={!!selected.featured}
                    onChange={(e) =>
                      patchEvent(selected.id, { featured: e.target.checked })
                    }
                  />
                  Featured (pin lớn hơn)
                </label>
                <label className="admin-events-span2">
                  ID (slug)
                  <input
                    value={selected.id}
                    onChange={(e) => {
                      const next = e.target.value.trim()
                      if (!next) return
                      const oldId = selected.id
                      setDataset((prev) => ({
                        ...prev,
                        events: prev.events.map((ev) =>
                          ev.id === oldId ? { ...ev, id: next } : ev,
                        ),
                      }))
                      setSelectedId(next)
                      setDirty(true)
                    }}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
