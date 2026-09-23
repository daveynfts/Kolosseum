/**
 * Client-side document title + meta for /scex (humans / in-app browsers).
 * Telegram/Facebook crawlers use middleware → /scex-preview.html (static OG HTML).
 */
import { applyDocumentSeo } from './seo'

const TITLE = 'Kolosseum — Đấu trường KOL crypto Việt Nam'
const DESCRIPTION =
  "Đấu trường ảnh hưởng KOL crypto Việt Nam: ma trận uy tín × tần suất, live feed X về SCEX và hồ sơ KOL từ dữ liệu gốc."

const CANONICAL = 'https://radar.daveynfts.com/scex'

export function applyScexSeo() {
  applyDocumentSeo({
    title: TITLE,
    description: DESCRIPTION,
    ogTitle: 'Kolosseum — Đấu trường KOL crypto Việt Nam',
    ogAlt: 'Kolosseum — đấu trường KOL crypto Việt Nam',
    canonical: CANONICAL,
    ogImage: new URL('/kolosseum-og.png', window.location.origin).href,
    themeColor: '#211817',
    siteName: 'Kolosseum',
  })
}
