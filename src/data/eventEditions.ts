/**
 * Event-map editions
 *
 *   /event                      → live map (new events, R2 events/live/v1.json)
 *   /event/conviction-2026      → archived Conviction week (untouched)
 */
export const LIVE_EVENT_SLUG = 'live'
export const CONVICTION_2026_SLUG = 'conviction-2026'
/** Default public map at /event */
export const DEFAULT_EVENT_SLUG = LIVE_EVENT_SLUG

/** `conviction-2026`, `token2049-2027` — no dots, no slash. */
export const EVENT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export type EventEditionStatus = 'live' | 'archive' | 'draft'

export type EventEditionMeta = {
  slug: string
  title: string
  year: number
  status: EventEditionStatus
  lumaUrl?: string
  homeUrl?: string
  logoUrl?: string
  ogImage?: string
  venueName?: string
  city?: string
  dateLabel?: string
  descriptionVi?: string
  descriptionEn?: string
}

export const EVENT_EDITIONS_INDEX_KEY = 'events/index.json'

export function parseEventSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (!EVENT_SLUG_RE.test(s)) return null
  return s
}

export function eventObjectKey(slug: string): string {
  const s = parseEventSlug(slug)
  if (!s) throw new Error('invalid_event_slug')
  return `events/${s}/v1.json`
}

export function eventPublicPath(slug: string): string {
  const s = parseEventSlug(slug) || DEFAULT_EVENT_SLUG
  if (s === LIVE_EVENT_SLUG) return '/event'
  return `/event/${s}`
}

export function isLiveEventPath(pathname: string): boolean {
  const p = (pathname || '/').replace(/\/+$/, '') || '/'
  return p.toLowerCase() === '/event' || p.toLowerCase() === '/event/live'
}

export function parseEventSlugFromPathname(pathname: string): string | null {
  const p = (pathname || '/').replace(/\/+$/, '') || '/'
  if (p.toLowerCase() === '/event' || p.toLowerCase() === '/event/live') {
    return LIVE_EVENT_SLUG
  }
  const m = /^\/event\/([^/?#]+)$/i.exec(p)
  if (!m) return null
  try {
    return parseEventSlug(decodeURIComponent(m[1]))
  } catch {
    return null
  }
}

/** `conviction-2026` → `conviction-2027`. Returns null if slug has no year. */
export function nextYearSlug(slug: string): string | null {
  const s = parseEventSlug(slug)
  if (!s) return null
  const m = /^(.*?)(20\d{2})$/.exec(s)
  if (!m) return null
  const next = `${m[1]}${Number(m[2]) + 1}`
  return parseEventSlug(next)
}

export function shiftIsoYear(iso: string, delta = 1): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  if (!m) return iso
  return `${Number(m[1]) + delta}-${m[2]}-${m[3]}`
}

export const SEED_EVENT_EDITIONS: EventEditionMeta[] = [
  {
    slug: LIVE_EVENT_SLUG,
    title: "Davey's Radar — Event Map",
    year: 2026,
    status: 'live',
    venueName: 'TP. Hồ Chí Minh',
    city: 'Việt Nam',
    descriptionVi:
      'Bản đồ side events mới trên Davey’s Radar. Cập nhật sự kiện tại đây — Conviction 2026 được lưu riêng.',
    descriptionEn:
      'Live side-event map on Davey’s Radar. Add new events here — Conviction 2026 stays archived.',
  },
  {
    slug: CONVICTION_2026_SLUG,
    title: 'Conviction 2026',
    year: 2026,
    status: 'archive',
    lumaUrl: 'https://luma.com/conviction-2026',
    homeUrl: 'https://www.conviction.vn/vi',
    logoUrl: '/conviction/logo-full.svg',
    ogImage:
      'https://radar.daveynfts.com/og/conviction-2026-events.jpg?v=20260817a',
    venueName: 'Thiskyhall Sala Convention Center',
    city: 'Thủ Đức, TP.HCM',
    dateLabel: '13–16/08/2026',
    descriptionVi:
      'Bản đồ lưu trữ side events Conviction 2026 tại TP.HCM. Pin, lịch và venue quanh Thiskyhall Sala.',
    descriptionEn:
      'Archive map of Conviction 2026 side events in Ho Chi Minh City around Thiskyhall Sala.',
  },
]

export function seedEditionBySlug(slug: string): EventEditionMeta | null {
  const s = parseEventSlug(slug)
  if (!s) return null
  return SEED_EVENT_EDITIONS.find((e) => e.slug === s) ?? null
}

export function yearFromSlug(slug: string): number | null {
  const m = /(20\d{2})$/.exec(slug)
  return m ? Number(m[1]) : null
}

export function titleFromSlug(slug: string): string {
  const known = seedEditionBySlug(slug)
  if (known) return known.title
  return slug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export function isConvictionEdition(slug: string): boolean {
  return parseEventSlug(slug)?.startsWith('conviction-') === true
}

/** Seed row, or a Conviction-family fallback so 2027 still gets brand chrome. */
export function editionMetaForSlug(slug: string): EventEditionMeta | null {
  const s = parseEventSlug(slug)
  if (!s) return null
  const known = seedEditionBySlug(s)
  if (known) return known
  if (!isConvictionEdition(s)) return null
  const base = seedEditionBySlug(CONVICTION_2026_SLUG)
  if (!base) return null
  return {
    ...base,
    slug: s,
    title: titleFromSlug(s),
    year: yearFromSlug(s) || base.year + 1,
    status: 'live',
    lumaUrl: undefined,
    dateLabel: undefined,
    descriptionVi: undefined,
    descriptionEn: undefined,
    ogImage: undefined,
  }
}

export type EventEditionIndex = {
  version: 1
  kind: 'event-editions'
  editions: EventEditionMeta[]
  updatedAt: string
}

export function normalizeEditionMeta(raw: unknown): EventEditionMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const slug = parseEventSlug(o.slug)
  if (!slug) return null
  const seed = seedEditionBySlug(slug)
  const year =
    typeof o.year === 'number' && Number.isFinite(o.year)
      ? o.year
      : yearFromSlug(slug) || seed?.year || new Date().getUTCFullYear()
  const statusRaw = String(o.status || seed?.status || 'draft')
  const status: EventEditionStatus =
    statusRaw === 'live' || statusRaw === 'archive' || statusRaw === 'draft'
      ? statusRaw
      : 'draft'
  const str = (v: unknown, fb = '') =>
    typeof v === 'string' && v.trim() ? v.trim() : fb
  return {
    slug,
    title: str(o.title, seed?.title || titleFromSlug(slug)),
    year,
    status,
    lumaUrl: str(o.lumaUrl, seed?.lumaUrl || '') || undefined,
    homeUrl: str(o.homeUrl, seed?.homeUrl || '') || undefined,
    logoUrl: str(o.logoUrl, seed?.logoUrl || '') || undefined,
    ogImage: str(o.ogImage, seed?.ogImage || '') || undefined,
    venueName: str(o.venueName, seed?.venueName || '') || undefined,
    city: str(o.city, seed?.city || '') || undefined,
    dateLabel: str(o.dateLabel, seed?.dateLabel || '') || undefined,
    descriptionVi:
      str(o.descriptionVi, seed?.descriptionVi || '') || undefined,
    descriptionEn:
      str(o.descriptionEn, seed?.descriptionEn || '') || undefined,
  }
}

/** Seed catalog first, then R2 index overwrites / appends by slug. */
export function mergeEditionCatalog(
  remote: unknown,
): EventEditionMeta[] {
  const bySlug = new Map<string, EventEditionMeta>()
  for (const e of SEED_EVENT_EDITIONS) bySlug.set(e.slug, e)
  if (
    remote &&
    typeof remote === 'object' &&
    (Array.isArray((remote as { events?: unknown }).events) ||
      (remote as { kind?: string }).kind === 'conviction-side-events')
  ) {
    // A side-event dataset leaked in (old API ignored ?list=1) — ignore.
    return [...bySlug.values()]
  }
  const rows =
    remote && typeof remote === 'object' && Array.isArray((remote as { editions?: unknown }).editions)
      ? ((remote as { editions: unknown[] }).editions)
      : []
  for (const row of rows) {
    const n = normalizeEditionMeta(row)
    if (n) bySlug.set(n.slug, { ...bySlug.get(n.slug), ...n })
  }
  return [...bySlug.values()].sort(compareEditions)
}

function compareEditions(a: EventEditionMeta, b: EventEditionMeta): number {
  if (a.slug === LIVE_EVENT_SLUG) return -1
  if (b.slug === LIVE_EVENT_SLUG) return 1
  if (b.year !== a.year) return b.year - a.year
  return a.slug.localeCompare(b.slug)
}

export function upsertEditionInCatalog(
  list: EventEditionMeta[],
  edition: EventEditionMeta,
): EventEditionMeta[] {
  const next = list.filter((e) => e.slug !== edition.slug)
  next.push(edition)
  return next.sort(compareEditions)
}

export function latestLiveSlug(editions: EventEditionMeta[]): string {
  const live =
    editions.find((e) => e.slug === LIVE_EVENT_SLUG) ||
    editions.find((e) => e.status === 'live')
  if (live) return live.slug
  return editions[0]?.slug || DEFAULT_EVENT_SLUG
}
