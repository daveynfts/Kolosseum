/**
 * Conviction 2026 side-event map — types + seed dataset.
 * Source: https://luma.com/conviction-2026 (as of 2026-08-04)
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

/** Thiskyhall Sala — Conviction main venue (Thủ Đức, TP.HCM). */
export const SALA_VENUE: MainVenue = {
  name: 'Thiskyhall Sala Convention Center',
  address:
    '10 Đường Mai Chí Thọ, An Khánh, Thủ Đức, Thành phố Hồ Chí Minh 71110, Vietnam',
  lat: 10.7719776,
  lng: 106.7210607,
}

/** Luma registration for the main forum (14–15/08). */
export const CONVICTION_MAIN_LUMA = 'https://luma.com/ydvhq4is'

/**
 * Main forum days at Thiskyhall (not side events).
 * Day 1 · 14/08 Blockchain & Tài sản số · Day 2 · 15/08 AI
 */
export const MAIN_FORUM_DAYS: Record<
  string,
  { day: 1 | 2; label: string; track: string; short: string }
> = {
  '2026-08-14': {
    day: 1,
    label: 'Main · Ngày 1',
    track: 'Blockchain & Tài sản số',
    short: 'Ngày 1',
  },
  '2026-08-15': {
    day: 2,
    label: 'Main · Ngày 2',
    track: 'Trí tuệ nhân tạo',
    short: 'Ngày 2',
  },
}

export function isMainForumDay(isoDate: string): boolean {
  return Boolean(MAIN_FORUM_DAYS[isoDate])
}

export function mainForumMeta(isoDate: string) {
  return MAIN_FORUM_DAYS[isoDate] || null
}

/** Stable id for the multi-day Conviction main forum entry on the map. */
export const MAIN_EVENT_ID = 'conviction-2026-main-event'

export function isMainEvent(ev: { id: string } | null | undefined): boolean {
  return !!ev && ev.id === MAIN_EVENT_ID
}

/**
 * Side event co-located at Thiskyhall Sala (e.g. Special AI Forum stage).
 * Used to label "Stage / Side" pins smaller than the Main forum pin.
 */
export function isMainVenueSideStage(
  ev: SideEvent,
  venue: { lat: number; lng: number } = SALA_VENUE,
  maxKm = 0.15,
): boolean {
  if (isMainEvent(ev) || ev.locationTbd) return false
  if (!Number.isFinite(ev.lat) || !Number.isFinite(ev.lng)) return false
  return distanceKm(ev.lat, ev.lng, venue.lat, venue.lng) <= maxKm
}

/** Split a day's list: Main forum first, then side events. */
export function partitionMainAndSide(events: SideEvent[]): {
  main: SideEvent[]
  side: SideEvent[]
} {
  const main: SideEvent[] = []
  const side: SideEvent[] = []
  for (const ev of events) {
    if (isMainEvent(ev)) main.push(ev)
    else side.push(ev)
  }
  return { main, side }
}

/**
 * Main forum wall-clock (Asia/Ho_Chi_Minh) — Luma Main Event:
 * Fri 14 Aug 08:00 → Sat 15 Aug 18:00 GMT+7 · Thiskyhall Sala, Thủ Đức.
 */
export const MAIN_FORUM_SCHEDULE = {
  startIso: '2026-08-14T08:00:00+07:00',
  endIso: '2026-08-15T18:00:00+07:00',
  day1StartIso: '2026-08-14T08:00:00+07:00',
  day1EndIso: '2026-08-14T22:00:00+07:00',
  day2StartIso: '2026-08-15T08:00:00+07:00',
  day2EndIso: '2026-08-15T18:00:00+07:00',
  venue: 'Thiskyhall Sala Convention Center',
  district: 'Thủ Đức, Thành phố Hồ Chí Minh',
  title: 'Conviction 2026 Main Event',
  /** Short label for map chrome */
  windowLabel: '14/08 08:00 – 15/08 18:00 GMT+7',
} as const

export type MainForumPhase = 'upcoming' | 'live' | 'ended'

export type MainForumCountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

export type MainForumStatus = {
  phase: MainForumPhase
  /** Target of the countdown: start (upcoming) or end of forum/day (live) */
  target: 'start' | 'end'
  parts: MainForumCountdownParts
  /** Short badge: Sắp diễn ra / LIVE / Đã kết thúc */
  badge: string
  /** Primary line */
  title: string
  /** Secondary line */
  subtitle: string
  liveDay?: 1 | 2
  liveTrack?: string
}

function splitMs(ms: number): MainForumCountdownParts {
  const totalMs = Math.max(0, ms)
  const sec = Math.floor(totalMs / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return { days, hours, minutes, seconds, totalMs }
}

/** Live status + countdown for main forum (VN timezone via fixed offsets). */
export function getMainForumStatus(now: Date = new Date()): MainForumStatus {
  const t = now.getTime()
  const start = new Date(MAIN_FORUM_SCHEDULE.startIso).getTime()
  const end = new Date(MAIN_FORUM_SCHEDULE.endIso).getTime()
  const d1s = new Date(MAIN_FORUM_SCHEDULE.day1StartIso).getTime()
  const d1e = new Date(MAIN_FORUM_SCHEDULE.day1EndIso).getTime()
  const d2s = new Date(MAIN_FORUM_SCHEDULE.day2StartIso).getTime()
  const d2e = new Date(MAIN_FORUM_SCHEDULE.day2EndIso).getTime()

  if (t < start) {
    return {
      phase: 'upcoming',
      target: 'start',
      parts: splitMs(start - t),
      badge: 'Sắp diễn ra',
      title: MAIN_FORUM_SCHEDULE.title,
      subtitle: `${MAIN_FORUM_SCHEDULE.venue} · ${MAIN_FORUM_SCHEDULE.district} · ${MAIN_FORUM_SCHEDULE.windowLabel}`,
    }
  }

  if (t >= end) {
    return {
      phase: 'ended',
      target: 'end',
      parts: splitMs(0),
      badge: 'Đã kết thúc',
      title: MAIN_FORUM_SCHEDULE.title,
      subtitle: 'Cảm ơn đã đồng hành · Xem lại side events trên map',
    }
  }

  // Live window
  let liveDay: 1 | 2 = 1
  let liveTrack = MAIN_FORUM_DAYS['2026-08-14'].track
  let dayEnd = d1e
  if (t >= d2s || (t >= d1e && t < d2s)) {
    // Between day1 evening and day2 morning still "live week" — treat as day 2 prep
    if (t >= d2s) {
      liveDay = 2
      liveTrack = MAIN_FORUM_DAYS['2026-08-15'].track
      dayEnd = d2e
    } else {
      liveDay = 1
      liveTrack = MAIN_FORUM_DAYS['2026-08-14'].track
      dayEnd = d2s // countdown to day 2 open
    }
  } else if (t >= d1s && t < d1e) {
    liveDay = 1
    liveTrack = MAIN_FORUM_DAYS['2026-08-14'].track
    dayEnd = d1e
  }

  const untilForumEnd = end - t
  const untilDayEnd = Math.max(0, dayEnd - t)
  // Prefer day-end when still on that day block; else forum end
  const useDay = untilDayEnd > 0 && untilDayEnd < untilForumEnd
  const remaining = useDay ? untilDayEnd : untilForumEnd

  return {
    phase: 'live',
    target: 'end',
    parts: splitMs(remaining),
    badge: 'LIVE',
    title: `Ngày ${liveDay} · ${liveTrack}`,
    subtitle: useDay
      ? `Đang diễn ra · còn lại đến hết block · ${MAIN_FORUM_SCHEDULE.venue}`
      : `Đang diễn ra · còn lại đến đóng cửa forum · ${MAIN_FORUM_SCHEDULE.venue}`,
    liveDay,
    liveTrack,
  }
}

export function formatCountdownParts(p: MainForumCountdownParts): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (p.days > 0) {
    return `${p.days}d ${pad(p.hours)}h ${pad(p.minutes)}m ${pad(p.seconds)}s`
  }
  if (p.hours > 0) {
    return `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`
  }
  return `${pad(p.minutes)}:${pad(p.seconds)}`
}

/** Compact pin chip: `3d 4h` · `12h 05m` · `45:12` · `12m` */
export function formatPinCountdown(ms: number): string {
  const p = splitMs(ms)
  if (p.days > 0) return `${p.days}d ${p.hours}h`
  if (p.hours > 0) return `${p.hours}h ${String(p.minutes).padStart(2, '0')}m`
  if (p.minutes > 0) return `${p.minutes}m ${String(p.seconds).padStart(2, '0')}s`
  return `${p.seconds}s`
}

export type SideEventPhase = 'upcoming' | 'live' | 'ended' | 'tbd'

export type SideEventStatus = {
  phase: SideEventPhase
  /** Short label on map pin */
  pinLabel: string
  detail: string
}

/** VN wall time → epoch ms for an event date + HH:mm */
function eventInstantMs(date: string, hhmm: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '09:00').trim())
  if (!m) return null
  const h = String(Number(m[1])).padStart(2, '0')
  const min = m[2]
  const t = new Date(`${date}T${h}:${min}:00+07:00`).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Per-side-event status for map pins: countdown / LIVE / END / TBD.
 * Uses Asia/Ho_Chi_Minh wall times (date + startTime/endTime).
 */
export type UiLocale = 'vi' | 'en'

/** Part of day for attendee filters (VN wall clock). */
export type TimeOfDayBucket = 'morning' | 'afternoon' | 'evening'

/**
 * Bucket by startTime: morning &lt;12, afternoon 12–16:59, evening ≥17.
 * dateTbd / missing time → null (excluded when a bucket is active).
 */
export function eventTimeOfDay(ev: SideEvent): TimeOfDayBucket | null {
  if (ev.dateTbd) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec((ev.startTime || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  const total = h * 60 + min
  if (total < 12 * 60) return 'morning'
  if (total < 17 * 60) return 'afternoon'
  return 'evening'
}

export function eventHasMapPin(ev: SideEvent): boolean {
  return !ev.locationTbd && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)
}

export function getSideEventStatus(
  ev: SideEvent,
  now: Date = new Date(),
  locale: UiLocale = 'vi',
): SideEventStatus {
  const en = locale === 'en'
  if (ev.dateTbd || !ev.date) {
    return {
      phase: 'tbd',
      pinLabel: 'TBD',
      detail: en ? 'Date not announced' : 'Ngày chưa công bố',
    }
  }

  const start = eventInstantMs(ev.date, ev.startTime || '09:00')
  if (start == null) {
    return {
      phase: 'tbd',
      pinLabel: 'TBD',
      detail: en ? 'Missing start time' : 'Thiếu giờ bắt đầu',
    }
  }

  let end =
    eventInstantMs(ev.endDate || ev.date, ev.endTime || '') ??
    // default duration 2h if no endTime
    start + 2 * 60 * 60 * 1000
  // if endTime parse failed but endDate/endTime empty, already defaulted
  if (ev.endTime) {
    const e = eventInstantMs(ev.endDate || ev.date, ev.endTime)
    if (e != null) end = e
  }
  if (end < start) end = start + 2 * 60 * 60 * 1000

  const t = now.getTime()
  if (t < start) {
    const ms = start - t
    const cd = formatCountdownParts(splitMs(ms))
    return {
      phase: 'upcoming',
      pinLabel: formatPinCountdown(ms),
      detail: en ? `Starts in ${cd}` : `Bắt đầu sau ${cd}`,
    }
  }
  if (t >= start && t < end) {
    const ms = end - t
    const left = formatPinCountdown(ms)
    return {
      phase: 'live',
      pinLabel: 'LIVE',
      detail: en ? `Live · ${left} left` : `Đang diễn ra · còn ${left}`,
    }
  }
  return {
    phase: 'ended',
    pinLabel: 'END',
    detail: en ? 'Ended' : 'Đã kết thúc',
  }
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

// ── Timeline / schedule conflicts (same day, overlapping wall-clock) ──

export type EventTimeWindow = {
  id: string
  startMs: number
  endMs: number
  /** Minutes from local midnight on `date` (clipped) */
  startMin: number
  endMin: number
}

function minutesOnDate(ms: number, date: string): number {
  const day0 = eventInstantMs(date, '00:00')
  if (day0 == null) return 0
  return Math.max(0, Math.min(24 * 60, Math.round((ms - day0) / 60_000)))
}

/** Absolute [start, end) for an event (VN offset). */
export function eventAbsoluteWindow(
  ev: SideEvent,
): { startMs: number; endMs: number } | null {
  if (ev.dateTbd || !ev.date) return null
  const start = eventInstantMs(ev.date, ev.startTime || '09:00')
  if (start == null) return null
  let end =
    eventInstantMs(ev.endDate || ev.date, ev.endTime || '') ??
    start + 2 * 60 * 60 * 1000
  if (ev.endTime) {
    const e = eventInstantMs(ev.endDate || ev.date, ev.endTime)
    if (e != null) end = e
  }
  if (end <= start) end = start + 2 * 60 * 60 * 1000
  return { startMs: start, endMs: end }
}

/**
 * Window clipped to a calendar day (for day timeline bars).
 * Multi-day Main: day1 08:00→24:00, day2 00:00→18:00, etc.
 */
export function eventWindowOnDate(
  ev: SideEvent,
  date: string,
): EventTimeWindow | null {
  if (!eventOccursOnDate(ev, date)) return null
  const abs = eventAbsoluteWindow(ev)
  if (!abs) return null
  const dayStart = eventInstantMs(date, '00:00')
  if (dayStart == null) return null
  const dayEnd = dayStart + 24 * 60 * 60 * 1000
  const startMs = Math.max(abs.startMs, dayStart)
  const endMs = Math.min(abs.endMs, dayEnd)
  if (endMs <= startMs) return null
  return {
    id: ev.id,
    startMs,
    endMs,
    startMin: minutesOnDate(startMs, date),
    endMin: minutesOnDate(endMs, date),
  }
}

export function windowsOverlap(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number },
): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs
}

/**
 * Map eventId → other events that overlap in absolute time.
 * By default Main forum is excluded from conflict pairs (it's the all-day base).
 */
export function buildConflictMap(
  events: SideEvent[],
  opts?: { includeMain?: boolean },
): Map<string, SideEvent[]> {
  const includeMain = opts?.includeMain === true
  const list = events.filter(
    (e) => !e.dateTbd && (includeMain || !isMainEvent(e)),
  )
  const windows = new Map<string, { startMs: number; endMs: number }>()
  for (const ev of list) {
    const w = eventAbsoluteWindow(ev)
    if (w) windows.set(ev.id, w)
  }
  const byId = new Map(list.map((e) => [e.id, e]))
  const out = new Map<string, SideEvent[]>()
  const ids = [...windows.keys()]
  for (const id of ids) out.set(id, [])
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!
      const b = ids[j]!
      if (!windowsOverlap(windows.get(a)!, windows.get(b)!)) continue
      out.get(a)!.push(byId.get(b)!)
      out.get(b)!.push(byId.get(a)!)
    }
  }
  return out
}

export type TimelineBar = {
  id: string
  title: string
  host: string
  venue: string
  type: SideEventType
  isMain: boolean
  isStage: boolean
  startMin: number
  endMin: number
  leftPct: number
  widthPct: number
  lane: number
  conflictIds: string[]
  conflictCount: number
  startLabel: string
  endLabel: string
  color: string
}

export type DayTimeline = {
  date: string
  rangeStartMin: number
  rangeEndMin: number
  hours: number[]
  bars: TimelineBar[]
  laneCount: number
  /** Side events that have ≥1 overlap with another side event */
  conflictedSideCount: number
}

function hmFromMin(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Build a day timeline with lanes + conflict counts for side events.
 * Main forum is drawn as a background bar (lane 0) and does not create "Trùng giờ".
 */
export function buildDayTimeline(
  events: SideEvent[],
  date: string,
): DayTimeline | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const onDay = events.filter((e) => eventOccursOnDate(e, date))
  if (!onDay.length) return null

  const conflicts = buildConflictMap(onDay, { includeMain: false })
  const windows: Array<{ ev: SideEvent; w: EventTimeWindow }> = []
  for (const ev of onDay) {
    const w = eventWindowOnDate(ev, date)
    if (w) windows.push({ ev, w })
  }
  if (!windows.length) return null

  let minM = Math.min(...windows.map((x) => x.w.startMin))
  let maxM = Math.max(...windows.map((x) => x.w.endMin))
  // Pad to whole hours, keep at least 08:00–22:00 feel when sparse
  minM = Math.max(0, Math.floor(minM / 60) * 60 - 30)
  maxM = Math.min(24 * 60, Math.ceil(maxM / 60) * 60 + 30)
  if (maxM - minM < 4 * 60) {
    minM = Math.max(0, minM - 60)
    maxM = Math.min(24 * 60, maxM + 60)
  }
  const span = Math.max(60, maxM - minM)

  // Assign lanes: Main always lane 0; sides pack greedily from lane 1
  const sorted = [...windows].sort((a, b) => {
    if (isMainEvent(a.ev) !== isMainEvent(b.ev)) {
      return isMainEvent(a.ev) ? -1 : 1
    }
    if (a.w.startMin !== b.w.startMin) return a.w.startMin - b.w.startMin
    return a.w.endMin - b.w.endMin
  })
  /** laneEnds[i] = minute when lane i becomes free again */
  const laneEnds: number[] = [0] // reserve lane 0 for Main
  const laneOf = new Map<string, number>()
  for (const { ev, w } of sorted) {
    if (isMainEvent(ev)) {
      laneOf.set(ev.id, 0)
      laneEnds[0] = Math.max(laneEnds[0] ?? 0, w.endMin)
      continue
    }
    let placedLane = -1
    for (let L = 1; L < laneEnds.length; L++) {
      if ((laneEnds[L] ?? 0) <= w.startMin) {
        placedLane = L
        break
      }
    }
    if (placedLane < 0) {
      placedLane = laneEnds.length
      laneEnds.push(0)
    }
    laneOf.set(ev.id, placedLane)
    laneEnds[placedLane] = w.endMin
  }

  const hours: number[] = []
  for (
    let h = Math.floor(minM / 60);
    h <= Math.floor((maxM - 1) / 60);
    h++
  ) {
    hours.push(h)
  }

  let conflictedSideCount = 0
  const bars: TimelineBar[] = sorted.map(({ ev, w }) => {
    const conf = (conflicts.get(ev.id) || []).map((c) => c.id)
    if (!isMainEvent(ev) && conf.length) conflictedSideCount++
    const leftPct = ((w.startMin - minM) / span) * 100
    const widthPct = Math.max(2.5, ((w.endMin - w.startMin) / span) * 100)
    return {
      id: ev.id,
      title: ev.title,
      host: ev.host,
      venue: ev.venue,
      type: ev.type,
      isMain: isMainEvent(ev),
      isStage: isMainVenueSideStage(ev),
      startMin: w.startMin,
      endMin: w.endMin,
      leftPct,
      widthPct,
      lane: laneOf.get(ev.id) ?? 1,
      conflictIds: conf,
      conflictCount: conf.length,
      startLabel: hmFromMin(w.startMin),
      endLabel: hmFromMin(w.endMin),
      color: isMainEvent(ev)
        ? '#fbbf24'
        : isMainVenueSideStage(ev)
          ? '#a78bfa'
          : EVENT_TYPE_COLORS[ev.type] || EVENT_TYPE_COLORS.other,
    }
  })

  const laneCount = Math.max(1, ...bars.map((b) => b.lane + 1), 2)

  return {
    date,
    rangeStartMin: minM,
    rangeEndMin: maxM,
    hours,
    bars,
    laneCount,
    conflictedSideCount,
  }
}

export function conflictLabel(
  others: SideEvent[],
  maxNames = 2,
  locale: UiLocale = 'vi',
): string {
  if (!others.length) return ''
  const trim = (t: string, max: number) => {
    const s = (t || '').trim()
    return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
  }
  const names = others.slice(0, maxNames).map((e) => trim(e.title, 22))
  const extra = others.length - names.length
  if (locale === 'en') {
    return extra > 0
      ? `Overlaps ${names.join(', ')} +${extra}`
      : `Overlaps ${names.join(', ')}`
  }
  return extra > 0
    ? `Trùng giờ với ${names.join(', ')} +${extra}`
    : `Trùng giờ với ${names.join(', ')}`
}

/**
 * Luma list thumbnails use square `uploads/` / `gallery-images/` covers
 * (not wide `event-social/` OG banners).
 */
export function toSquareImageUrl(url: string, size = 400): string {
  const u = (url || '').trim()
  if (!u) return ''
  // Already on our R2 / media proxy — do not rewrite
  if (
    /\/api\/media\?id=/i.test(u) ||
    /\.r2\.dev\/media\//i.test(u) ||
    /\/media\/[a-f0-9]{16,}/i.test(u)
  ) {
    return u
  }
  // Already a Cloudflare image transform URL
  if (u.includes('lumacdn.com/cdn-cgi/image/')) {
    return u
      .replace(/width=\d+(\.\d+)?/i, `width=${size}`)
      .replace(/height=\d+(\.\d+)?/i, `height=${size}`)
  }
  // Raw lumacdn asset → wrap as square cover (same params Luma calendar uses)
  const m = u.match(
    /images\.lumacdn\.com\/((?:uploads|gallery-images|event-covers)\/.+)$/i,
  )
  if (m) return lumaSquareCover(m[1], size)
  return u
}

/** Square cover like Luma calendar cards. */
function lumaSquareCover(assetPath: string, size = 400): string {
  const path = assetPath.replace(/^\//, '')
  return `https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=1,background=white,quality=75,width=${size},height=${size}/${path}`
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
    imageUrl: lumaSquareCover(
      'uploads/yq/78eafb7b-e23f-42cb-8dfe-0c7533515f53.png',
    ),
    description:
      'Chương trình 3 ngày: networking founder–VC, demo, investor matchmaking, workshop và chung kết Quantum Founder Challenge. Ngày/địa điểm chỉ hiện sau khi đăng ký Luma.',
    dateTbd: true,
    locationTbd: true,
    featured: true,
  },
  {
    id: 'pudgy-renaiss-tcg-coffee-meetup',
    title: 'Pudgy Việt Nam x Renaiss Việt Nam TCG Coffee Meet Up',
    host: 'Pudgy Penguins · Renaiss Việt Nam',
    venue: 'Nexus Café & Collectibles Hub',
    address:
      'Nexus Café & Collectibles Hub, TP.HCM (địa chỉ chi tiết sau khi duyệt Luma)',
    lat: 10.78227862795571,
    lng: 106.68400199263297,
    date: '2026-08-13',
    startTime: '13:30',
    endTime: '16:00',
    type: 'meetup',
    link: 'https://luma.com/lnyyozdg',
    imageUrl: lumaSquareCover(
      'uploads/ae/a2c53c3c-c166-40f8-83b4-9b7ffa0f0916.jpg',
    ),
    description:
      'TCG coffee meetup · Pudgy Penguins × Renaiss: collector, Pokémon/TCG, networking, minigame & merch. Free · Approval required · 13:00 check-in · 13:30–16:00 program.',
    free: true,
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
    imageUrl: lumaSquareCover(
      'uploads/pu/26ae8101-9d72-4148-a5a9-605158939f7a.png',
    ),
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
    address: '219 Nguyễn Trãi, Cầu Ông Lãnh, Hồ Chí Minh, Vietnam',
    lat: 10.7652678,
    lng: 106.6878883,
    date: '2026-08-13',
    startTime: '18:30',
    endTime: '21:30',
    type: 'meetup',
    link: 'https://luma.com/rmyweq6d',
    imageUrl: lumaSquareCover(
      'uploads/hn/6e7ca317-74ef-4c6a-af4e-08bf3f1808a3.webp',
    ),
    description:
      'Ra mắt Kanga Global University — giao lưu cộng đồng và blockchain education. Free craft beer & finger food · Approval required.',
    free: true,
    featured: true,
  },
  {
    id: 'hydra-tokenised-capital-markets',
    title:
      "Building Vietnam's Tokenised Capital Markets: Lessons from Singapore",
    host: 'Hydra X',
    venue: 'L26 · Bitexco Financial Tower',
    address:
      'L26, Bitexco Financial Tower, No. 2 Hai Trieu Street, Sai Gon Ward, Ho Chi Minh City, Vietnam',
    lat: 10.77162,
    lng: 106.70428,
    date: '2026-08-14',
    startTime: '16:00',
    endTime: '18:00',
    type: 'conference',
    link: 'https://luma.com/kfl0ulwv',
    imageUrl: lumaSquareCover(
      'gallery-images/6n/63fec81d-4939-46b0-89dc-dee963a97b5b.png',
    ),
    description:
      'Private gathering (banks, securities, digital assets) on regulated tokenised markets — lessons from Singapore. Approval required · Luma may hide address until approved.',
    featured: true,
  },
  {
    id: 'crypto-football-conviction-2026',
    title: 'Crypto Football @Conviction 2026',
    host: 'Thomas Doan',
    venue: 'TP.HCM — TBD (revealed after approval)',
    address: 'Đăng ký Luma để xem địa điểm (Spectator / Player)',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-13',
    startTime: '17:00',
    endTime: '18:30',
    type: 'other',
    link: 'https://luma.com/d57b9tsu',
    imageUrl: lumaSquareCover(
      'uploads/ge/1087be2c-5c88-48c6-9b66-e07df14276d3.png',
    ),
    description:
      'Bóng đá + networking builders/founders trong tuần Conviction. Vé Spectator hoặc Player · approval required · địa điểm chỉ hiện sau khi duyệt.',
    locationTbd: true,
    featured: true,
  },
  {
    id: 'one-of-us-run-coffee',
    title:
      'ONE OF US Run & Coffee // Aya, Cudis, 071Labs, Superteam Vietnam & Aethir',
    host: 'Aya Trade · ONE OF US',
    venue: 'Sala Park',
    address: 'Sala Park, An Khánh, Thủ Đức, TP. Hồ Chí Minh',
    lat: 10.770365,
    lng: 106.725919,
    date: '2026-08-14',
    startTime: '07:30',
    endTime: '09:00',
    type: 'meetup',
    link: 'https://luma.com/i98g8zzc',
    imageUrl: lumaSquareCover(
      'uploads/uk/b25c7e0b-eaad-4775-8d28-d3534f749d55.png',
    ),
    description:
      'Run & Coffee morning session with ONE OF US, Aya Trade, Cudis, 071Labs, Superteam VN & Aethir — networking before the main forum.',
    free: true,
    featured: true,
  },
  {
    id: 'liminal-custody-meetup-conviction',
    title: 'Liminal Networking Meetup',
    host: 'Nguyen Steven',
    venue: 'Starbucks - Thiso Mall',
    address:
      'Starbucks · Thiso Mall / SALA Shopping Mall, 10 Mai Chí Thọ, An Khánh, Thủ Đức, TP.HCM',
    lat: 10.7720392,
    lng: 106.7225104,
    date: '2026-08-14',
    startTime: '09:00',
    endTime: '18:00',
    type: 'meetup',
    link: 'https://luma.com/yj5vu7oc',
    imageUrl: lumaSquareCover(
      'gallery-images/8y/d9f86a31-556f-454f-923f-16fecc8e742b',
    ),
    description:
      'Liminal Networking Meetup bên lề Conviction — digital asset custody & security. 09:00–18:00 tại Starbucks Thiso Mall (Sala).',
    free: true,
    featured: true,
  },
  {
    id: 'busan-blockchain-summit-business-meetup',
    title:
      '[2026 Busan Blockchain Global Summit in Vietnam] Business Meet-Up',
    host: '2026 Busan Blockchain Global Summit',
    venue: 'Thiskyhall Sala Convention Center',
    address: SALA_VENUE.address,
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '14:00',
    endTime: '16:30',
    type: 'conference',
    link: 'https://luma.com/gbiw9d5s',
    imageUrl: lumaSquareCover(
      'uploads/xz/433c8edd-c25f-4e5a-a1e3-a4e88ba06147.jpg',
    ),
    description:
      'Busan Metropolitan City & Busan Techno Park — business collaboration between Korean and Vietnamese blockchain companies. At Thiskyhall Sala during Conviction week.',
    free: true,
    featured: true,
  },
  {
    id: 'busan-blockchain-summit-networking-dinner',
    title:
      '[2026 Busan Blockchain Global Summit in Vietnam] Networking Dinner',
    host: '2026 Busan Blockchain Global Summit',
    venue: 'Thiskyhall Sala Convention Center',
    address: SALA_VENUE.address,
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '18:00',
    endTime: '20:00',
    type: 'mixer',
    link: 'https://luma.com/natlp21z',
    imageUrl: lumaSquareCover(
      'uploads/3z/df49e6ae-0ce0-4901-9d73-51f990344530.jpg',
    ),
    description:
      'Networking dinner for Korea–Vietnam participants after the day’s programs — continue conversations and explore partnerships. Thiskyhall Sala.',
    free: true,
    featured: true,
  },
  {
    id: 'builders-happy-hours-hcmc',
    title: 'Builders Happy Hours HCMC',
    host: 'APAC DAO · Utila · ETHGlobal · Unlimit',
    venue: 'Shared with approved guests',
    address: 'Địa điểm chỉ hiện sau khi được duyệt trên Luma (không còn Oromia)',
    lat: SALA_VENUE.lat,
    lng: SALA_VENUE.lng,
    date: '2026-08-14',
    startTime: '16:00',
    endTime: '19:00',
    type: 'mixer',
    link: 'https://luma.com/jjnzcz06',
    imageUrl: lumaSquareCover(
      'uploads/xr/c0229197-d0cc-4cb9-98c1-dc5c367a6bac.png',
    ),
    description:
      'Side event chính thức của Conviction 2026 (ETHGlobal, Unlimit, Utila · co-host APAC DAO). 16:00 opening · 16:30–18:00 workshop · 18:00–19:00 Q&A & sunset networking. Location: Shared with approved guests — đăng ký/Luma approval để xem địa điểm (đã bỏ Oromia Coffee & Lounge).',
    free: true,
    featured: true,
    locationTbd: true,
  },
  {
    id: 'redotsclub-vietnam-welcome-mixer',
    title: 'RedotsClub Vietnam: Welcome Mixer at Conviction 2026',
    host: 'RedotsClub · Fauvie',
    venue: '5050 Coffee Tea - Sala',
    address: '5050 Coffee Tea - Sala, Thành phố Hồ Chí Minh, Hồ Chí Minh',
    lat: 10.7688195,
    lng: 106.7274942,
    date: '2026-08-14',
    startTime: '16:00',
    endTime: '19:00',
    type: 'mixer',
    link: 'https://luma.com/cj4ukn2e',
    imageUrl: lumaSquareCover(
      'uploads/qs/097fb09c-2fd2-4ba4-8308-89fe182a2fc0.jpg',
    ),
    description:
      'Ra mắt RedotsClub Vietnam — mixer RedotPay community: networking, team meet-up, real-world digital payments. Approval required · chỉ khách đã duyệt được vào.',
    free: true,
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
    imageUrl: lumaSquareCover(
      'uploads/ax/6d6a63e8-3508-4d42-b0fb-7bfae7fbb3e5.png',
    ),
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
    imageUrl: lumaSquareCover(
      'gallery-images/n2/0a544d41-3888-47b5-bdbc-c5d8cc5131e6',
    ),
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
    imageUrl: lumaSquareCover(
      'uploads/ji/008e31c4-8909-4839-a33a-d52423ba18be.png',
    ),
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
    imageUrl: lumaSquareCover(
      'uploads/zl/b0c2e514-a237-44b2-b8c9-9481cc89dd85.png',
    ),
    description:
      'Meetup developer: Solana, smart accounts, security, infrastructure, AI × Crypto. GitHub + approval.',
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
    imageUrl: lumaSquareCover(
      'uploads/r3/a23a0658-4378-41a9-8ad4-3955d2f08fd9.gif',
    ),
    description:
      'AI, RWA, tokenisation, stablecoins, institutional finance và blockchain adoption.',
    featured: true,
  },
  {
    id: 'web3-builders-breakfast-hiding-the-chain',
    title: "Web3 Builders' Breakfast: Hiding the Chain ☕",
    host: "sqrDAO's Curated Events · Sky Mavis",
    venue: 'The Sentry L',
    address: 'The Sentry L, Thành phố Hồ Chí Minh, Hồ Chí Minh',
    lat: 10.780275,
    lng: 106.704758,
    date: '2026-08-15',
    startTime: '09:00',
    endTime: '12:00',
    type: 'meetup',
    link: 'https://luma.com/buildersbreakfast4',
    imageUrl: lumaSquareCover(
      'uploads/oc/8862f35a-54c5-43db-b7e9-cdf56d6c6ca0.jpg',
    ),
    description:
      "Web3 Builders' Breakfast 4th edition · sqrDAO × Sky Mavis — casual morning with builders, food & strategy. Hiding the Chain · free meetup.",
    free: true,
    featured: true,
  },
  {
    id: 'unlimited-conviction-sundowner',
    title: 'Unlimit(ed) Conviction Sundowner',
    host: 'APAC DAO · Unlimit',
    venue: 'Ômm Mixology Saigon',
    address: 'Ômm Mixology Saigon, Thành phố Hồ Chí Minh, Hồ Chí Minh',
    lat: 10.7702142,
    lng: 106.7052468,
    date: '2026-08-15',
    startTime: '18:00',
    endTime: '20:00',
    type: 'mixer',
    link: 'https://luma.com/jg1vrpif',
    imageUrl: lumaSquareCover(
      'uploads/yx/078e26e2-d0e2-4b0f-8c78-9cce1300adbd.png',
    ),
    description:
      'Premium side event: payments & infrastructure leaders — opening remarks, project intros, networking. À-la-carte dinner & cocktails · Approval required.',
    featured: true,
  },
  {
    id: 'arc-community-meetup-stablecoin-hcmc',
    title:
      'HCMC | Arc Community Meetup & New Location Kickoff: The Stablecoin Movement',
    host: 'Arc Meetups · Lecter Vu',
    venue: 'Home Hotel',
    address:
      'G Floor, Home Hotel · 158 Nguyễn Đình Chính, Phú Nhuận, TP. Hồ Chí Minh',
    lat: 10.7956116,
    lng: 106.6755465,
    date: '2026-08-16',
    startTime: '09:00',
    endTime: '12:00',
    type: 'meetup',
    link: 'https://community.arc.io/public/clubs/vietnam/events/hcmc-or-community-meetup-and-new-location-kickoff-the-stablecoin-movement-1s1r2ck6sm',
    imageUrl:
      'https://d2xo500swnpgl1.cloudfront.net/uploads/arc/Vietnam-General-Meetup-1--2905f765-43f7-4265-ac8d-bb2c978a210f-1784744297269.jpeg',
    description:
      'Arc community meetup — stablecoins reshaping payments, savings & investing; infrastructure on Arc; opportunities for builders in Vietnam. Free · New location kickoff at Home Hotel Phú Nhuận.',
    free: true,
    featured: true,
  },
]

export const CONVICTION_EVENTS_SEED: SideEventDataset = {
  version: 1,
  kind: 'conviction-side-events',
  event: 'conviction-2026',
  title: 'Conviction 2026 — Side Events Map',
  venue: SALA_VENUE,
  dateRange: { start: '2026-08-13', end: '2026-08-16' },
  events: SIDE_EVENTS,
  updatedAt: '2026-08-10T08:00:00.000Z',
  note: 'Busan Blockchain Global Summit · Business Meet-Up + Networking Dinner · 14/08 Sala',
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

const WEEKDAYS_VI_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Calendar cell weekday: T5, CN, … (UTC date parts from ISO) */
export function formatWeekdayShortVi(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return ''
  return WEEKDAYS_VI_SHORT[d.getUTCDay()] || ''
}

/** Day number 1–31 */
export function formatDayNum(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  return m ? String(Number(m[3])) : isoDate
}

/** “Tháng 8 · 2026” */
export function formatMonthYearVi(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return ''
  return `Tháng ${Number(m[2])} · ${m[1]}`
}

/**
 * Calendar strip dates: expand dataset.dateRange + any confirmed event days outside.
 */
export function calendarStripDates(
  dateRange: { start: string; end: string },
  events: SideEvent[],
): string[] {
  const set = new Set<string>()
  for (const d of datesInRange(dateRange.start, dateRange.end)) set.add(d)
  for (const d of confirmedEventDates(events)) set.add(d)
  return [...set].sort()
}

/** Luma-style time: 4:00 PM */
export function formatLumaTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim())
  if (!m) return hhmm || ''
  let h = Number(m[1])
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${min} ${ampm}`
}

const WEEKDAYS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
]

/** Luma-style day header: Thursday, August 13 */
export function formatLumaDay(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return formatShortDate(isoDate)
  const weekday = WEEKDAYS_VI[d.getUTCDay()] || ''
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${weekday}, ${months[Number(m[2]) - 1]} ${Number(m[3])}`
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

/**
 * Spread pins that share the same lat/lng so they don't stack (e.g. Main +
 * Special AI Forum both at Thiskyhall Sala on 15/08).
 * Returns display positions only — real coords stay for directions/distance.
 */
export function pinDisplayPositions(
  events: SideEvent[],
  radiusM = 36,
): Map<string, { lat: number; lng: number }> {
  const out = new Map<string, { lat: number; lng: number }>()
  const groups = new Map<string, SideEvent[]>()

  for (const ev of events) {
    if (ev.locationTbd) continue
    if (!Number.isFinite(ev.lat) || !Number.isFinite(ev.lng)) continue
    // ~1.1 m grid at equator; enough to cluster true duplicates
    const key = `${ev.lat.toFixed(5)},${ev.lng.toFixed(5)}`
    const g = groups.get(key) || []
    g.push(ev)
    groups.set(key, g)
  }

  // meters → degrees around HCMC (~10.77°N)
  const meanLat =
    events.reduce((s, e) => s + (e.locationTbd ? 0 : e.lat), 0) /
      Math.max(1, events.filter((e) => !e.locationTbd).length) || 10.77
  const degPerMLat = 1 / 111_320
  const degPerMLng = 1 / (111_320 * Math.cos((meanLat * Math.PI) / 180))

  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0]!
      out.set(only.id, { lat: only.lat, lng: only.lng })
      continue
    }
    const sorted = [...group].sort((a, b) => {
      // Keep Main Event as anchor (first) then by start time / title
      if (a.id === MAIN_EVENT_ID) return -1
      if (b.id === MAIN_EVENT_ID) return 1
      if (a.startTime !== b.startTime) {
        return a.startTime.localeCompare(b.startTime)
      }
      return a.title.localeCompare(b.title)
    })
    const n = sorted.length
    const cx = sorted[0]!.lng
    const cy = sorted[0]!.lat
    sorted.forEach((ev, i) => {
      // 2 pins: left/right of center; 3+: ring starting north
      let angle: number
      if (n === 2) {
        angle = i === 0 ? -Math.PI / 2.2 : Math.PI / 2.2
      } else {
        angle = (2 * Math.PI * i) / n - Math.PI / 2
      }
      const r = radiusM * (1 + 0.12 * Math.floor(i / 6))
      out.set(ev.id, {
        lat: cy + r * Math.cos(angle) * degPerMLat,
        lng: cx + r * Math.sin(angle) * degPerMLng,
      })
    })
  }
  return out
}

/** Haversine distance in kilometers. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Compact VN distance label: `350 m` / `1.2 km`. */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—'
  if (km < 0.05) return '< 50 m'
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/**
 * Driving / xe máy ETA at ~20 km/h (urban traffic, HCMC-ish).
 * `~12 phút đi xe` / `~1h15m đi xe`
 */
export function formatDriveEta(km: number, locale: UiLocale = 'vi'): string {
  if (!Number.isFinite(km) || km < 0) return '—'
  const min = Math.max(1, Math.round((km / 20) * 60))
  if (km < 0.05) return locale === 'en' ? '< 1 min ride' : '< 1 phút đi xe'
  if (min < 60) {
    return locale === 'en' ? `~${min} min ride` : `~${min} phút đi xe`
  }
  const h = Math.floor(min / 60)
  const m = min % 60
  if (locale === 'en') {
    return m
      ? `~${h}h${String(m).padStart(2, '0')}m ride`
      : `~${h}h ride`
  }
  return m ? `~${h}h${String(m).padStart(2, '0')}m đi xe` : `~${h}h đi xe`
}

/** @deprecated Use formatDriveEta — kept for call-site compatibility */
export const formatWalkEta = formatDriveEta

/** Combined: `1.2 km · ~4 phút đi xe từ Sala` */
export function formatDistanceWithDrive(
  km: number,
  fromLabel = 'Sala',
  locale: UiLocale = 'vi',
): string {
  const eta = formatDriveEta(km, locale)
  if (locale === 'en') {
    return `${formatDistanceKm(km)} · ${eta} from ${fromLabel}`
  }
  return `${formatDistanceKm(km)} · ${eta} từ ${fromLabel}`
}

/** @deprecated Use formatDistanceWithDrive */
export const formatDistanceWithWalk = formatDistanceWithDrive

function hmToMinutes(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hm || '').trim())
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Sort for field use: live first → upcoming today by startTime → later days → past today last.
 */
export function sortEventsUpcoming(
  list: SideEvent[],
  today: string,
  nowHm: string,
): SideEvent[] {
  const nowMin = hmToMinutes(nowHm)
  const score = (ev: SideEvent) => {
    if (ev.dateTbd) return 900_000
    const onToday = eventOccursOnDate(ev, today)
    const startMin = hmToMinutes(ev.startTime || '00:00')
    const endMin = hmToMinutes(ev.endTime || '23:59')
    if (onToday && nowMin >= startMin && nowMin <= endMin) return startMin // live, earliest first
    if (onToday && startMin >= nowMin) return 1_000 + startMin // upcoming today
    if (onToday && endMin < nowMin) return 50_000 + startMin // past today
    if (ev.date > today) {
      // later days: date ordinal + time
      return 10_000 + ev.date.localeCompare(today) * 1_440 + startMin
    }
    return 80_000 + startMin // past days
  }
  return [...list].sort((a, b) => {
    const d = score(a) - score(b)
    if (d !== 0) return d
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.startTime || '').localeCompare(b.startTime || '')
  })
}

export function eventDistanceKm(
  from: { lat: number; lng: number },
  ev: SideEvent,
): number | null {
  if (ev.locationTbd) return null
  if (!Number.isFinite(ev.lat) || !Number.isFinite(ev.lng)) return null
  return distanceKm(from.lat, from.lng, ev.lat, ev.lng)
}

export type RoutePoint = {
  id: string
  lat: number
  lng: number
  label?: string
}

export type RouteSegment = {
  id: string
  fromId: string
  toId: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  km: number
  shortLabel: string
  fullLabel: string
  step: number
}

/**
 * Open tour via nearest-neighbour from `start` through all points.
 * Easy-to-read “optimal enough” drive order between nearby events.
 */
export function buildNearestNeighborRoute(
  start: RoutePoint,
  points: RoutePoint[],
): { order: RoutePoint[]; segments: RouteSegment[]; totalKm: number } {
  const remaining = points.filter(
    (p) =>
      p.id !== start.id &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng),
  )
  const order: RoutePoint[] = [start]
  let cur = start
  let totalKm = 0
  const segments: RouteSegment[] = []
  let step = 1

  while (remaining.length) {
    let bestIdx = 0
    let bestKm = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i]
      const km = distanceKm(cur.lat, cur.lng, p.lat, p.lng)
      if (km < bestKm) {
        bestKm = km
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    totalKm += bestKm
    segments.push({
      id: `seg-${step}-${cur.id}-${next.id}`,
      fromId: cur.id,
      toId: next.id,
      from: { lat: cur.lat, lng: cur.lng },
      to: { lat: next.lat, lng: next.lng },
      km: bestKm,
      shortLabel: `${formatDistanceKm(bestKm)} · ${formatDriveEta(bestKm)}`,
      fullLabel: `Chặng ${step}: ${formatDistanceKm(bestKm)} · ${formatDriveEta(bestKm)} (đi xe)`,
      step,
    })
    order.push(next)
    cur = next
    step++
  }

  return { order, segments, totalKm }
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
