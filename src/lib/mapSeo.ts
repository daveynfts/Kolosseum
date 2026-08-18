/**
 * Client-side document title + meta for `/` (humans / in-app browsers).
 * Social crawlers use middleware → /map-preview.html (static OG HTML).
 */
import { SITE_ORIGIN, applyDocumentSeo, type DocumentSeo } from './seo'
import { kolShareUrl, normalizeKolHandle } from './kolDeepLink'

const MAP_OG = `${SITE_ORIGIN}/og/vn-kol-map.jpg?v=20260818a`

export type MapSeoKol = {
  handle: string
  displayName: string
}

export function mapSeoPack(kol?: MapSeoKol | null): DocumentSeo {
  if (kol) {
    const handle = normalizeKolHandle(kol.handle) || kol.handle.replace(/^@+/, '')
    const name = kol.displayName.trim() || handle
    const canonical = kolShareUrl(SITE_ORIGIN, handle) || `${SITE_ORIGIN}/`
    const ogTitle = `${name} (@${handle}) — Davey's Radar`
    const description = `${name} (@${handle}) trên bản đồ KOL crypto Việt Nam — Davey's Radar.`
    return {
      title: ogTitle,
      description,
      ogTitle,
      ogAlt: `${name} on Davey's Radar`,
      canonical,
      ogImage: MAP_OG,
      themeColor: '#05060a',
    }
  }
  return {
    title: "Davey's Radar — VN KOL Map",
    description:
      "Davey's Radar — bản đồ KOL crypto Việt Nam, ma trận SCEX và side events Conviction.",
    ogTitle: "Davey's Radar — VN KOL Map",
    ogAlt: "Davey's Radar — Vietnamese crypto KOL constellation map",
    canonical: `${SITE_ORIGIN}/`,
    ogImage: MAP_OG,
    themeColor: '#05060a',
  }
}

export function applyMapSeo(kol?: MapSeoKol | null) {
  applyDocumentSeo(mapSeoPack(kol))
}
