/**
 * Client-side document title + meta for /event (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → event-preview.html instead.
 */

const TITLE = 'Conviction 2026 — Side Events Map | DaveyNFTs'
const DESCRIPTION =
  'Bản đồ side events Conviction 2026 tại TP.HCM (14–15/08). Lịch, pin, khoảng cách, trùng giờ — Thiskyhall Sala & venues around the city.'
const DESCRIPTION_EN =
  'Interactive map of Conviction 2026 side events in Ho Chi Minh City · 14–15 Aug · calendar, pins, distance & schedule conflicts.'
const OG_IMAGE = 'https://radar.daveynfts.com/api/og-conviction-events'
const CANONICAL = 'https://radar.daveynfts.com/event/conviction-2026'

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

export function applyEventMapSeo(locale: 'vi' | 'en' = 'vi') {
  const desc = locale === 'en' ? DESCRIPTION_EN : DESCRIPTION
  document.title = TITLE

  upsertMeta('name', 'description', desc)
  upsertMeta('name', 'theme-color', '#030305')

  upsertMeta('property', 'og:site_name', 'DaveyNFTs Radar')
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:url', CANONICAL)
  upsertMeta('property', 'og:title', 'Conviction 2026 — Side Events Map')
  upsertMeta('property', 'og:description', DESCRIPTION_EN)
  upsertMeta('property', 'og:image', OG_IMAGE)
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')
  upsertMeta(
    'property',
    'og:image:alt',
    'Conviction 2026 Side Events Map — Ho Chi Minh City',
  )

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', 'Conviction 2026 — Side Events Map')
  upsertMeta('name', 'twitter:description', DESCRIPTION_EN)
  upsertMeta('name', 'twitter:image', OG_IMAGE)

  upsertLink('canonical', CANONICAL)
}
