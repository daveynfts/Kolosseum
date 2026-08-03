/**
 * Conviction 2026 side-event map — types + seed dataset.
 * Venue: Thiskyhall Sala, TP.HCM · Main forum 14–15 Aug 2026.
 */

export const EVENT_TYPES = [
  'mixer',
  'workshop',
  'hackathon',
  'meetup',
  'party',
  'conference',
  'other',
] as const

export type SideEventType = (typeof EVENT_TYPES)[number]

export type SideEvent = {
  id: string
  title: string
  host: string
  venue: string
  address: string
  lat: number
  lng: number
  /** YYYY-MM-DD */
  date: string
  /** HH:mm (Asia/Ho_Chi_Minh) */
  startTime: string
  endTime?: string
  /** Multi-day end date YYYY-MM-DD */
  endDate?: string
  type: SideEventType
  link?: string
  description?: string
  free?: boolean
  featured?: boolean
}

export type MainVenue = {
  name: string
  address: string
  lat: number
  lng: number
}

export type SideEventDataset = {
  version: 1
  kind: 'conviction-side-events'
  event: 'conviction-2026'
  title: string
  venue: MainVenue
  /** Inclusive date range for filter chips */
  dateRange: { start: string; end: string }
  events: SideEvent[]
  updatedAt: string
  note?: string
}

/** Thiskyhall Sala approximate coords (Quận 2 / Thủ Đức area). */
export const SALA_VENUE: MainVenue = {
  name: 'Thiskyhall Sala',
  address: 'Thiskyhall Sala, TP. Thủ Đức, TP. Hồ Chí Minh',
  lat: 10.7269,
  lng: 106.7204,
}

export const EVENT_TYPE_LABELS: Record<SideEventType, string> = {
  mixer: 'Mixer',
  workshop: 'Workshop',
  hackathon: 'Hackathon',
  meetup: 'Meetup',
  party: 'Party',
  conference: 'Conference',
  other: 'Khác',
}

export const EVENT_TYPE_COLORS: Record<SideEventType, string> = {
  mixer: '#38bdf8',
  workshop: '#a78bfa',
  hackathon: '#34d399',
  meetup: '#fbbf24',
  party: '#f472b6',
  conference: '#fb923c',
  other: '#94a3b8',
}

const SAMPLE_EVENTS: SideEvent[] = [
  {
    id: 'conviction-main-day1',
    title: 'Conviction 2026 — Ngày 1: Blockchain & Tài Sản Số',
    host: 'Conviction',
    venue: 'Thiskyhall Sala',
    address: SALA_VENUE.address,
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '08:30',
    endTime: '18:00',
    type: 'conference',
    link: 'https://www.conviction.vn/vi',
    description:
      'Diễn đàn cấp quốc gia về Tài sản số và Blockchain. Đăng ký tại conviction.vn.',
    free: false,
    featured: true,
  },
  {
    id: 'conviction-main-day2',
    title: 'Conviction 2026 — Ngày 2: Trí Tuệ Nhân Tạo',
    host: 'Conviction',
    venue: 'Thiskyhall Sala',
    address: SALA_VENUE.address,
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-15',
    startTime: '08:30',
    endTime: '18:00',
    type: 'conference',
    link: 'https://www.conviction.vn/vi',
    description:
      'Ngày hội AI doanh nghiệp, hạ tầng AI và nền tảng năng suất thế hệ mới.',
    free: false,
    featured: true,
  },
  {
    id: 'sample-builder-mixer',
    title: 'Builder Mixer · Night Before',
    host: 'Community (mẫu)',
    venue: 'District 1 — TBD',
    address: 'Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    lat: 10.7769,
    lng: 106.7009,
    date: '2026-08-13',
    startTime: '19:00',
    endTime: '22:00',
    type: 'mixer',
    description:
      'Side event mẫu — thay bằng sự kiện thật qua Admin → Events.',
    free: true,
    featured: false,
  },
]

export const CONVICTION_EVENTS_SEED: SideEventDataset = {
  version: 1,
  kind: 'conviction-side-events',
  event: 'conviction-2026',
  title: 'Conviction 2026 — Side Events Map',
  venue: SALA_VENUE,
  dateRange: { start: '2026-08-13', end: '2026-08-16' },
  events: SAMPLE_EVENTS,
  updatedAt: '2026-08-01T00:00:00.000Z',
  note: 'Seed — cập nhật qua Admin → Events',
}

function isEventType(v: unknown): v is SideEventType {
  return typeof v === 'string' && (EVENT_TYPES as readonly string[]).includes(v)
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v.trim() : fallback
}

export function normalizeSideEvent(raw: unknown): SideEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id)
  const title = str(o.title)
  const lat = num(o.lat, NaN)
  const lng = num(o.lng, NaN)
  const date = str(o.date)
  if (!id || !title || !date || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const type: SideEventType = isEventType(o.type) ? o.type : 'other'
  return {
    id,
    title,
    host: str(o.host),
    venue: str(o.venue),
    address: str(o.address),
    lat,
    lng,
    date,
    startTime: str(o.startTime, '09:00') || '09:00',
    endTime: str(o.endTime) || undefined,
    endDate: str(o.endDate) || undefined,
    type,
    link: str(o.link) || undefined,
    description: str(o.description) || undefined,
    free: o.free === true,
    featured: o.featured === true,
  }
}

export function normalizeDataset(raw: unknown): SideEventDataset | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const eventsRaw = Array.isArray(o.events) ? o.events : []
  const events = eventsRaw
    .map(normalizeSideEvent)
    .filter((e): e is SideEvent => !!e)

  const venueRaw =
    o.venue && typeof o.venue === 'object'
      ? (o.venue as Record<string, unknown>)
      : null
  const venue: MainVenue = {
    name: str(venueRaw?.name, SALA_VENUE.name) || SALA_VENUE.name,
    address: str(venueRaw?.address, SALA_VENUE.address) || SALA_VENUE.address,
    lat: num(venueRaw?.lat, SALA_VENUE.lat),
    lng: num(venueRaw?.lng, SALA_VENUE.lng),
  }

  const rangeRaw =
    o.dateRange && typeof o.dateRange === 'object'
      ? (o.dateRange as Record<string, unknown>)
      : null

  return {
    version: 1,
    kind: 'conviction-side-events',
    event: 'conviction-2026',
    title:
      str(o.title, CONVICTION_EVENTS_SEED.title) || CONVICTION_EVENTS_SEED.title,
    venue,
    dateRange: {
      start:
        str(rangeRaw?.start, CONVICTION_EVENTS_SEED.dateRange.start) ||
        CONVICTION_EVENTS_SEED.dateRange.start,
      end:
        str(rangeRaw?.end, CONVICTION_EVENTS_SEED.dateRange.end) ||
        CONVICTION_EVENTS_SEED.dateRange.end,
    },
    events,
    updatedAt: str(o.updatedAt) || new Date().toISOString(),
    note: str(o.note) || undefined,
  }
}

/** Inclusive list of YYYY-MM-DD between start and end. */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) {
    return out
  }
  const cur = new Date(s)
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

export function eventOccursOnDate(ev: SideEvent, date: string): boolean {
  if (ev.date === date) return true
  if (ev.endDate && ev.endDate >= date && ev.date <= date) return true
  return false
}

export function eventsOnDate(events: SideEvent[], date: string): SideEvent[] {
  return events.filter((e) => eventOccursOnDate(e, date))
}

export function sortEvents(events: SideEvent[]): SideEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
    return a.title.localeCompare(b.title)
  })
}

export function createEmptySideEvent(partial?: Partial<SideEvent>): SideEvent {
  const id =
    partial?.id ||
    `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return {
    id,
    title: partial?.title ?? '',
    host: partial?.host ?? '',
    venue: partial?.venue ?? '',
    address: partial?.address ?? '',
    lat: partial?.lat ?? SALA_VENUE.lat,
    lng: partial?.lng ?? SALA_VENUE.lng,
    date: partial?.date ?? '2026-08-14',
    startTime: partial?.startTime ?? '18:00',
    endTime: partial?.endTime,
    endDate: partial?.endDate,
    type: partial?.type ?? 'meetup',
    link: partial?.link,
    description: partial?.description,
    free: partial?.free ?? false,
    featured: partial?.featured ?? false,
  }
}

/** Format date for UI: 14/08 */
export function formatShortDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${m[3]}/${m[2]}`
}

/** Google Maps directions URL */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/** Simple .ics content for one event (local VN wall time as floating). */
export function eventToIcs(ev: SideEvent): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  const start = `${ev.date.replace(/-/g, '')}T${(ev.startTime || '09:00').replace(':', '')}00`
  const endDate = ev.endDate || ev.date
  const endTime = ev.endTime || ev.startTime || '10:00'
  const end = `${endDate.replace(/-/g, '')}T${endTime.replace(':', '')}00`
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KOL Radar//Conviction 2026//VI',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@radar.daveynfts.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(ev.title)}`,
    `LOCATION:${escape([ev.venue, ev.address].filter(Boolean).join(' — '))}`,
    ev.description ? `DESCRIPTION:${escape(ev.description)}` : '',
    ev.link ? `URL:${ev.link}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n')
}
