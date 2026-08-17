/**
 * Client-side document title + meta for /event (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → /event-preview.html (static OG HTML).
 */

const CANONICAL = 'https://radar.daveynfts.com/event/conviction-2026'
/** Cache-bust query when replacing the product screenshot OG card. */
const OG_IMAGE =
  'https://radar.daveynfts.com/og/conviction-2026-events.jpg?v=20260817a'

const LIVE = {
  title: 'Conviction 2026 — Side Events Map | DaveyNFTs',
  descriptionVi:
    'Bản đồ side events Conviction 2026 tại TP.HCM (14–15/08). Lịch, pin, khoảng cách, trùng giờ — Thiskyhall Sala & venues around the city.',
  descriptionEn:
    'Interactive map of Conviction 2026 side events in Ho Chi Minh City · 14–15 Aug · calendar, pins, distance & schedule conflicts.',
  ogTitle: 'Conviction 2026 — Side Events Map',
  ogAlt: 'Conviction 2026 Side Events Map — Ho Chi Minh City',
}

const ARCHIVE = {
  title: 'Conviction 2026 — Side Events Map (Archive) | DaveyNFTs',
  descriptionVi:
    'Bản đồ lưu trữ side events Conviction 2026 (13–16/08, TP.HCM). Sự kiện đã kết thúc — xem lại pin, lịch & venue quanh Thiskyhall Sala.',
  descriptionEn:
    'Archive map of Conviction 2026 side events in Ho Chi Minh City (13–16 Aug). Event week has ended — browse pins, schedule & venues.',
  ogTitle: 'Conviction 2026 — Side Events Map (Archive)',
  ogAlt: 'Conviction 2026 Side Events Map — archive · Ho Chi Minh City',
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

export function applyEventMapSeo(
  locale: 'vi' | 'en' = 'vi',
  opts: { archived?: boolean } = {},
) {
  const pack = opts.archived ? ARCHIVE : LIVE
  const desc = locale === 'en' ? pack.descriptionEn : pack.descriptionVi
  document.title = pack.title

  upsertMeta('name', 'description', desc)
  upsertMeta('name', 'theme-color', '#030305')

  upsertMeta('property', 'og:site_name', 'DaveyNFTs Radar')
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:url', CANONICAL)
  upsertMeta('property', 'og:title', pack.ogTitle)
  upsertMeta('property', 'og:description', pack.descriptionEn)
  upsertMeta('property', 'og:image', OG_IMAGE)
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')
  upsertMeta('property', 'og:image:alt', pack.ogAlt)

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', pack.ogTitle)
  upsertMeta('name', 'twitter:description', pack.descriptionEn)
  upsertMeta('name', 'twitter:image', OG_IMAGE)

  upsertLink('canonical', CANONICAL)
}
