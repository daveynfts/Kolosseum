/**
 * Client-side document title + meta for /event and /event/:slug
 * (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → static OG HTML.
 */
import type { EventEditionMeta } from '../data/eventEditions'
import { DEFAULT_EVENT_SLUG } from '../data/eventEditions'

const SITE = 'https://radar.daveynfts.com'
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

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
) {
  let el = document.head.querySelector(
    `meta[${attr}="${key}"]`,
  ) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

function applyPack(opts: {
  title: string
  description: string
  ogTitle: string
  ogAlt: string
  canonical: string
  ogImage: string
}) {
  document.title = opts.title
  upsertMeta('name', 'description', opts.description)
  upsertMeta('name', 'theme-color', '#030305')
  upsertMeta('property', 'og:site_name', 'DaveyNFTs Radar')
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:url', opts.canonical)
  upsertMeta('property', 'og:title', opts.ogTitle)
  upsertMeta('property', 'og:description', opts.description)
  upsertMeta('property', 'og:image', opts.ogImage)
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')
  upsertMeta('property', 'og:image:alt', opts.ogAlt)
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', opts.ogTitle)
  upsertMeta('name', 'twitter:description', opts.description)
  upsertMeta('name', 'twitter:image', opts.ogImage)
  upsertLink('canonical', opts.canonical)
}

export function applyEventHubSeo(locale: 'vi' | 'en' = 'vi') {
  const title =
    locale === 'en'
      ? 'Event maps | DaveyNFTs Radar'
      : 'Bản đồ sự kiện | DaveyNFTs Radar'
  const description =
    locale === 'en'
      ? 'Side-event maps on Davey’s Radar. Each conference week has its own URL — last year stays archived, next year starts a new map.'
      : 'Bản đồ side events trên Davey’s Radar. Mỗi tuần sự kiện có URL riêng — năm trước lưu trữ, năm sau mở map mới.'
  applyPack({
    title,
    description,
    ogTitle: title,
    ogAlt: 'Davey’s Radar event maps',
    canonical: `${SITE}/event`,
    ogImage: DEFAULT_OG,
  })
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
  const canonical = `${SITE}/event/${slug}`
  const archived = opts.archived === true || opts.edition?.status === 'archive'

  if (slug === DEFAULT_EVENT_SLUG) {
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
