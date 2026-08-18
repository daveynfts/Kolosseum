/** Shared document title / Open Graph helpers (client-side). */

export const SITE_ORIGIN = 'https://radar.daveynfts.com'

export type DocumentSeo = {
  title: string
  description: string
  ogTitle: string
  ogAlt: string
  canonical: string
  ogImage: string
  themeColor?: string
}

export function upsertMeta(
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

export function upsertLink(rel: string, href: string) {
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

export function applyDocumentSeo(opts: DocumentSeo) {
  document.title = opts.title
  upsertMeta('name', 'description', opts.description)
  upsertMeta('name', 'theme-color', opts.themeColor || '#05060a')
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
