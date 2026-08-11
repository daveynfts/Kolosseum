/**
 * Client-side document title + meta for /scex (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → /scex-preview.html (static OG HTML).
 */

const TITLE = 'SCEX Radar — Ma trận KOL & Live Feed | DaveyNFTs'
const DESCRIPTION =
  "Ai đang nói về SCEX · ma trận KOL (uy tín × volume) + Live Feed X · On Davey's Radar."
/** Cache-bust query when replacing the product screenshot OG card. */
const OG_IMAGE = 'https://radar.daveynfts.com/og/scex-radar.jpg?v=20260811a'
const CANONICAL = 'https://radar.daveynfts.com/scex'

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

export function applyScexSeo() {
  document.title = TITLE

  upsertMeta('name', 'description', DESCRIPTION)
  upsertMeta('name', 'theme-color', '#05060a')

  upsertMeta('property', 'og:site_name', 'DaveyNFTs Radar')
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:url', CANONICAL)
  upsertMeta(
    'property',
    'og:title',
    'SCEX Radar — Ma trận KOL & Live Feed',
  )
  upsertMeta('property', 'og:description', DESCRIPTION)
  upsertMeta('property', 'og:image', OG_IMAGE)
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')
  upsertMeta(
    'property',
    'og:image:alt',
    'SCEX Radar — Ma trận SCEX & Live Feed',
  )

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta(
    'name',
    'twitter:title',
    'SCEX Radar — Ma trận KOL & Live Feed',
  )
  upsertMeta('name', 'twitter:description', DESCRIPTION)
  upsertMeta('name', 'twitter:image', OG_IMAGE)

  upsertLink('canonical', CANONICAL)
}
