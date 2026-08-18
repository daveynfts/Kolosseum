/**
 * Client-side document title + meta for /event and /event/:slug
 * (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → static OG HTML.
 */
import type { EventEditionMeta } from '../data/eventEditions'
import {
  CONVICTION_2026_SLUG,
  DEFAULT_EVENT_SLUG,
  LIVE_EVENT_SLUG,
  eventPublicPath,
} from '../data/eventEditions'
import { SITE_ORIGIN, applyDocumentSeo } from './seo'

const SITE = SITE_ORIGIN
const DEFAULT_OG =
  'https://radar.daveynfts.com/og/conviction-2026-events.jpg?v=20260817a'

const CONVICTION_2026 = {
  live: {
    title: 'Conviction 2026 — Side Events Map | DaveyNFTs',
    descriptionVi:
      'Bản đồ side events Conviction 2026 tại TP.HCM (14–15/08). Lịch, pin, khoảng cách, trùng giờ — Thiskyhall Sala & venues around the city.',
    descriptionEn:
      'Interactive map of Conviction 2026 side events in Ho Chi Minh City · 14–15 Aug · calendar, pins, distance & schedule conflicts.',
    ogTitle: 'Conviction 2026 — Side Events Map',
    ogAlt: 'Conviction 2026 Side Events Map — Ho Chi Minh City',
  },
  archive: {
    title: 'Conviction 2026 — Side Events Map (Archive) | DaveyNFTs',
    descriptionVi:
      'Bản đồ lưu trữ side events Conviction 2026 (13–16/08, TP.HCM). Sự kiện đã kết thúc — xem lại pin, lịch & venue quanh Thiskyhall Sala.',
    descriptionEn:
      'Archive map of Conviction 2026 side events in Ho Chi Minh City (13–16 Aug). Event week has ended — browse pins, schedule & venues.',
    ogTitle: 'Conviction 2026 — Side Events Map (Archive)',
    ogAlt: 'Conviction 2026 Side Events Map — archive · Ho Chi Minh City',
  },
}

function applyPack(opts: {
  title: string
  description: string
  ogTitle: string
  ogAlt: string
  canonical: string
  ogImage: string
}) {
  applyDocumentSeo({ ...opts, themeColor: '#030305' })
}

export function applyEventHubSeo(locale: 'vi' | 'en' = 'vi') {
  applyEventMapSeo(locale, { slug: LIVE_EVENT_SLUG })
}

export function applyEventMapSeo(
  locale: 'vi' | 'en' = 'vi',
  opts: {
    archived?: boolean
    slug?: string
    edition?: EventEditionMeta | null
    title?: string
  } = {},
) {
  const slug = opts.slug || opts.edition?.slug || DEFAULT_EVENT_SLUG
  const canonical = `${SITE}${eventPublicPath(slug)}`
  const archived = opts.archived === true || opts.edition?.status === 'archive'

  if (slug === LIVE_EVENT_SLUG) {
    const title =
      opts.title ||
      (locale === 'en'
        ? 'Event Map | DaveyNFTs Radar'
        : 'Bản đồ sự kiện | DaveyNFTs Radar')
    const description =
      locale === 'en'
        ? 'Live side-event map on Davey’s Radar. Add and browse new events in Ho Chi Minh City.'
        : 'Bản đồ side events mới trên Davey’s Radar. Cập nhật sự kiện tại TP.HCM tại đây.'
    applyPack({
      title,
      description,
      ogTitle: title,
      ogAlt: 'Davey’s Radar event map',
      canonical,
      ogImage: opts.edition?.ogImage || DEFAULT_OG,
    })
    return
  }

  if (slug === CONVICTION_2026_SLUG) {
    const pack = archived ? CONVICTION_2026.archive : CONVICTION_2026.live
    const desc = locale === 'en' ? pack.descriptionEn : pack.descriptionVi
    applyPack({
      title: pack.title,
      description: desc,
      ogTitle: pack.ogTitle,
      ogAlt: pack.ogAlt,
      canonical,
      ogImage: opts.edition?.ogImage || DEFAULT_OG,
    })
    return
  }

  const name = opts.title || opts.edition?.title || slug
  const suffix = archived
    ? locale === 'en'
      ? 'Archive'
      : 'Lưu trữ'
    : 'Side Events Map'
  const description =
    locale === 'en'
      ? opts.edition?.descriptionEn ||
        `Interactive side-event map for ${name}.`
      : opts.edition?.descriptionVi ||
        `Bản đồ side events ${name}.`
  applyPack({
    title: `${name} — ${suffix} | DaveyNFTs`,
    description,
    ogTitle: `${name} — ${suffix}`,
    ogAlt: `${name} side events map`,
    canonical,
    ogImage: opts.edition?.ogImage || DEFAULT_OG,
  })
}
