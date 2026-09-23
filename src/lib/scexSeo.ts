/**
 * Client-side document title + meta for /scex (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → /scex-preview.html (static OG HTML).
 */
import { applyDocumentSeo } from './seo'

const TITLE = 'Kolosseum — The Vietnamese Crypto KOL Arena'
const DESCRIPTION =
  "Explore Vietnamese crypto KOLs through a credibility and volume matrix, live SCEX posts on X, and sourced KOL profiles."

const CANONICAL = 'https://radar.daveynfts.com/scex'

export function applyScexSeo() {
  applyDocumentSeo({
    title: TITLE,
    description: DESCRIPTION,
    ogTitle: 'Kolosseum — The Vietnamese Crypto KOL Arena',
    ogAlt: 'Kolosseum — Vietnamese crypto KOL arena',
    canonical: CANONICAL,
    ogImage: new URL('/kolosseum-og.png', window.location.origin).href,
    themeColor: '#211817',
    siteName: 'Kolosseum',
  })
}
