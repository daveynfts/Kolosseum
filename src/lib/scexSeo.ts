/**
 * Client-side document title + meta for /scex (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → /scex-preview.html (static OG HTML).
 */
import { applyDocumentSeo } from './seo'

const TITLE = 'SCEX Radar — Ma trận KOL & Live Feed | DaveyNFTs'
const DESCRIPTION =
  "Ai đang nói về SCEX · ma trận KOL (uy tín × volume) + Live Feed X · On Davey's Radar."
/** Cache-bust query when replacing the product screenshot OG card. */
const OG_IMAGE = 'https://radar.daveynfts.com/og/scex-radar.jpg?v=20260811a'
const CANONICAL = 'https://radar.daveynfts.com/scex'

export function applyScexSeo() {
  applyDocumentSeo({
    title: TITLE,
    description: DESCRIPTION,
    ogTitle: 'SCEX Radar — Ma trận KOL & Live Feed',
    ogAlt: 'SCEX Radar — Ma trận SCEX & Live Feed',
    canonical: CANONICAL,
    ogImage: OG_IMAGE,
    themeColor: '#05060a',
  })
}
