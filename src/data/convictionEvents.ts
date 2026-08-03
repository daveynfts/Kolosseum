/**
 * Conviction 2026 side-event map — types + seed dataset.
 * Source: https://luma.com/conviction-2026 (as of 2026-08-03)
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
  /** Luma / social cover image */
  imageUrl?: string
  description?: string
  free?: boolean
  featured?: boolean
  /** Date not public yet on Luma */
  dateTbd?: boolean
  /** Exact pin is provisional until venue is announced */
  locationTbd?: boolean
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

/** Thiskyhall Sala — Conviction main venue (10 Mai Chí Thọ, Sala). */
export const SALA_VENUE: MainVenue = {
  name: 'Thiskyhall Sala',
  address:
    'Thiskyhall Sala Convention Center, 10 Mai Chí Thọ, KĐT Sala, An Khánh, TP. Hồ Chí Minh',
  lat: 10.771895,
  lng: 106.721066,
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

/** Prefer square crop from Luma CDN image URLs. */
export function toSquareImageUrl(url: string, size = 160): string {
  const u = (url || '').trim()
  if (!u) return ''
  if (u.includes('lumacdn.com/cdn-cgi/image/')) {
    return u
      .replace(/width=\d+/i, `width=${size}`)
      .replace(/height=\d+/i, `height=${size}`)
  }
  return u
}

function lumaImg(pathId: string): string {
  return `https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=1,anim=false,background=white,quality=75,width=400,height=400/${pathId}`
}

/**
 * Official side events from Luma calendar (excl. main Conviction forum).
 * https://luma.com/conviction-2026 — snapshot 2026-08-03
 */
/**
 * Coords notes (2026-08-03):
 * - Sala: 10times / venue listing 10.771895, 106.721066
 * - Hilton Saigon: Nominatim
 * - Chill Skybar / A&B Tower: Photon OSM
 * - 219 Nguyễn Trãi (Cầu Ông Lãnh): street segment approx.
 * - 22B Nguyễn Thị Diệu: street geocode D3
 * - locationTbd: lat/lng kept as Sala placeholder but markers are hidden on map
 */
const SIDE_EVENTS: SideEvent[] = [
  {
    id: 'quantum-founder-summit-2026',
    title: 'Quantum Founder Summit 2026: Build. Pitch. Raise.',
    host: 'Moon Ventures',
    venue: 'TP.HCM — TBD',
    address: 'Chưa công khai — xem trên Luma khi đăng ký',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-13',
    startTime: '09:00',
    type: 'conference',
    link: 'https://luma.com/9t56rzat',
    imageUrl: lumaImg('event-social/97/c4f15105-15bd-4239-b355-b0791092d54d.png'),
    description:
      'Chương trình 3 ngày: networking founder–VC, demo, investor matchmaking, workshop và chung kết Quantum Founder Challenge. Ngày/địa điểm chỉ hiện sau khi đăng ký Luma.',
    dateTbd: true,
    locationTbd: true,
    featured: true,
  },
  {
    id: 'vietnam-onchain',
    title: 'Vietnam Onchain',
    host: 'Vietnam Onchain',
    venue: 'TP.HCM — TBD',
    address: 'Chưa công khai địa điểm (ngày 13/08 đã xác nhận)',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-13',
    startTime: '16:00',
    endTime: '20:00',
    type: 'meetup',
    link: 'https://luma.com/2cwc66wt',
    imageUrl: lumaImg('event-social/qm/000bf9c4-4dce-4813-8722-d7f8ed05a75c.png'),
    description:
      'Digital assets, stablecoins, payment infrastructure, DeFi và AI × Crypto. Pin map ẩn tới khi có địa điểm.',
    locationTbd: true,
    featured: true,
  },
  {
    id: 'university-night',
    title: 'University Night',
    host: 'Kanga Global University',
    venue: 'ZumWhere Nguyễn Trãi',
    address: '219 Nguyễn Trãi, Cầu Ông Lãnh, TP. Hồ Chí Minh',
    lat: 10.7635,
    lng: 106.6868,
    date: '2026-08-13',
    startTime: '18:30',
    endTime: '21:30',
    type: 'meetup',
    link: 'https://luma.com/rmyweq6d',
    imageUrl: lumaImg('event-social/b8/9823b0b7-8ff0-48e9-8b43-69b73950f463.png'),
    description:
      'Ra mắt Kanga Global University — giao lưu cộng đồng và blockchain education. Approval required.',
    free: true,
    featured: true,
  },
  {
    id: 'hydra-tokenised-capital-markets',
    title:
      "Building Vietnam's Tokenised Capital Markets: Lessons from Singapore",
    host: 'Hydra X',
    venue: 'TP.HCM — TBD',
    address: 'Chưa công khai ngày giờ địa điểm',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '14:00',
    type: 'conference',
    link: 'https://luma.com/kfl0ulwv',
    imageUrl: lumaImg('event-social/i2/7bcd82ac-6f73-4370-9000-b0e37cf413b3.png'),
    description:
      'Sự kiện riêng cho ngân hàng, chứng khoán và hệ sinh thái tài sản số — bài học từ Singapore. Pin map ẩn tới khi công khai.',
    dateTbd: true,
    locationTbd: true,
  },
  {
    id: 'builders-happy-hours-hcmc',
    title: 'Builders Happy Hours HCMC',
    host: 'APAC DAO · Utila · ETHGlobal',
    venue: 'TP.HCM — TBD',
    address: 'Chưa công khai ngày/địa điểm (khung giờ dự kiến 16:00–19:00)',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '16:00',
    endTime: '19:00',
    type: 'mixer',
    link: 'https://luma.com/jjnzcz06',
    imageUrl: lumaImg('event-social/3n/e5ca8ad8-03eb-40fd-a0e9-4689182de514.png'),
    description:
      'Side event buổi tối: workshop, Q&A và networking. Ngày + địa điểm vẫn TBD trên Luma.',
    dateTbd: true,
    locationTbd: true,
    featured: true,
  },
  {
    id: 'lbank-labs-vip-saigon-nights',
    title: 'LBANK Labs VIP Saigon Nights',
    host: 'LBank Labs',
    venue: 'Chill Skybar · A&B Tower',
    address: 'Tầng 26–27, A&B Tower, 76A Lê Lai, Bến Thành, TP. Hồ Chí Minh',
    lat: 10.770425,
    lng: 106.694336,
    date: '2026-08-14',
    startTime: '19:00',
    endTime: '22:00',
    type: 'party',
    link: 'https://luma.com/lbanklabs-vipsaigonnights',
    imageUrl: lumaImg('event-social/g9/c59bd1c6-a147-444f-88a9-53fe7329d664.png'),
    description:
      'Networking, DJ, đồ uống, lucky draw. Invite-only · dress code Smart Casual.',
    featured: true,
  },
  {
    id: 'vietnam-connect-superteam',
    title: 'Vietnam Connect by Superteam Vietnam',
    host: 'Superteam Vietnam',
    venue: 'TP.HCM — TBD',
    address: 'Chưa công khai — cần duyệt đăng ký Luma',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '18:00',
    type: 'meetup',
    link: 'https://luma.com/4cqom8cq',
    imageUrl: lumaImg('event-social/az/f161a0d1-fcf0-4877-a384-fd9c5735e0c9.png'),
    description:
      'Networking dinner nhỏ cho builders/founders/investors Solana — không sân khấu/pitching.',
    dateTbd: true,
    locationTbd: true,
  },
  {
    id: 'special-ai-forum-conviction',
    title: 'The Special AI Forum at Conviction 2026',
    host: 'Nghiên AI & CONVICTION',
    venue: 'Nghiên AI Stage · Thiskyhall Sala',
    address:
      'Phòng Solar, Tầng 5, Thiskyhall Sala, 10 Mai Chí Thọ, An Khánh, TP.HCM',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-15',
    startTime: '09:00',
    endTime: '15:00',
    type: 'conference',
    link: 'https://luma.com/09nj7hiv',
    imageUrl: lumaImg('event-social/t2/e9e790c0-2c9f-42a0-8447-4b2085a7c1e7.png'),
    description:
      '5 phiên Media / Business / AI Agent. Check-in từ 08:30. Approval required.',
    featured: true,
  },
  {
    id: 'onlydevs-vietnam',
    title: 'OnlyDevs Vietnam',
    host: 'OnlyDevs',
    venue: '22B Nguyễn Thị Diệu',
    address: '22B Nguyễn Thị Diệu, Quận 3, TP. Hồ Chí Minh',
    lat: 10.77686,
    lng: 106.68953,
    date: '2026-08-14',
    startTime: '09:30',
    endTime: '17:30',
    type: 'meetup',
    link: 'https://luma.com/izmstgd3',
    imageUrl: lumaImg('event-social/52/40f0e361-6a4e-403e-b807-dd02c74a5445.png'),
    description:
      'Meetup developer: Solana, smart accounts, security, infrastructure, AI × Crypto. GitHub + approval. Ngày xác nhận trên Luma.',
    dateTbd: true,
    featured: true,
  },
  {
    id: 'hsc-conference-hcmc',
    title: 'HSC Conference Ho Chi Minh',
    host: 'Metaverse Post',
    venue: 'Hilton Saigon',
    address: '11 Công trường Mê Linh, Quận 1, TP. Hồ Chí Minh',
    lat: 10.775058,
    lng: 106.705713,
    date: '2026-08-15',
    startTime: '11:00',
    endTime: '18:00',
    type: 'conference',
    link: 'https://luma.com/HSC_HoChiMinh',
    imageUrl: lumaImg('event-social/xg/e5436302-2daf-486f-a529-ebd9b7d59e49.png'),
    description:
      'AI, RWA, tokenisation, stablecoins, institutional finance và blockchain adoption.',
    featured: true,
  },
]

export const CONVICTION_EVENTS_SEED: SideEventDataset = {
  version: 1,
  kind: 'conviction-side-events',
  event: 'conviction-2026',
  title: 'Conviction 2026 — Side Events Map',
  venue: SALA_VENUE,
  dateRange: { start: '2026-08-13', end: '2026-08-15' },
  events: SIDE_EVENTS,
  updatedAt: '2026-08-03T05:00:00.000Z',
  note: 'Seed luma.com/conviction-2026 · coords verified 2026-08-03 · TBD pins hidden on map',
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
    imageUrl: str(o.imageUrl) || undefined,
    description: str(o.description) || undefined,
    free: o.free === true,
    featured: o.featured === true,
    dateTbd: o.dateTbd === true,
    locationTbd: o.locationTbd === true,
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

/** Confirmed calendar match only — dateTbd events never match a concrete day. */
export function eventOccursOnDate(ev: SideEvent, date: string): boolean {
  if (ev.dateTbd) return false
  if (ev.date === date) return true
  if (ev.endDate && ev.endDate >= date && ev.date <= date) return true
  return false
}

/**
 * Date filter chip matcher.
 * - `all`: everything
 * - `tbd`: only events with dateTbd
 * - `YYYY-MM-DD`: confirmed events on that day (excludes dateTbd)
 */
export function matchesDateFilter(ev: SideEvent, filter: string): boolean {
  if (!filter || filter === 'all') return true
  if (filter === 'tbd') return !!ev.dateTbd
  return eventOccursOnDate(ev, filter)
}

export function eventsOnDate(events: SideEvent[], date: string): SideEvent[] {
  return events.filter((e) => eventOccursOnDate(e, date))
}

/** Dates that actually have at least one confirmed (non-TBD) event. */
export function confirmedEventDates(events: SideEvent[]): string[] {
  const set = new Set<string>()
  for (const ev of events) {
    if (ev.dateTbd) continue
    set.add(ev.date)
    if (ev.endDate) {
      for (const d of datesInRange(ev.date, ev.endDate)) set.add(d)
    }
  }
  return [...set].sort()
}

export function sortEvents(events: SideEvent[]): SideEvent[] {
  return [...events].sort((a, b) => {
    if (a.dateTbd !== b.dateTbd) return a.dateTbd ? 1 : -1
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
    imageUrl: partial?.imageUrl,
    description: partial?.description,
    free: partial?.free ?? false,
    featured: partial?.featured ?? false,
    dateTbd: partial?.dateTbd ?? false,
    locationTbd: partial?.locationTbd ?? false,
  }
}

/** Format date for UI: 14/08 */
export function formatShortDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${m[3]}/${m[2]}`
}

export function shortEventTitle(title: string, max = 28): string {
  const t = (title || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
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
    s
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
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
