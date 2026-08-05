/**
 * Crawler-facing HTML for Telegram / social previews of the event map.
 * GET /api/event-share
 *
 * Humans should use /event/conviction-2026 (SPA). Middleware rewrites bots here.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SITE = 'https://radar.daveynfts.com'
const PAGE = `${SITE}/event/conviction-2026`
const IMAGE = `${SITE}/og/conviction-2026-events.jpg`
const TITLE = 'Conviction 2026 — Side Events Map'
const DESC =
  'Interactive map of Conviction 2026 side events in Ho Chi Minh City · 14–15 Aug · calendar, pins, distance & schedule conflicts · Thiskyhall Sala.'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(TITLE)} | DaveyNFTs</title>
  <meta name="description" content="${escapeHtml(DESC)}" />
  <meta name="theme-color" content="#030305" />
  <link rel="canonical" href="${PAGE}" />

  <meta property="og:site_name" content="DaveyNFTs Radar" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="vi_VN" />
  <meta property="og:url" content="${PAGE}" />
  <meta property="og:title" content="${escapeHtml(TITLE)}" />
  <meta property="og:description" content="${escapeHtml(DESC)}" />
  <meta property="og:image" content="${IMAGE}" />
  <meta property="og:image:secure_url" content="${IMAGE}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Conviction 2026 Side Events Map — Ho Chi Minh City" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(TITLE)}" />
  <meta name="twitter:description" content="${escapeHtml(DESC)}" />
  <meta name="twitter:image" content="${IMAGE}" />
</head>
<body style="margin:0;background:#030305;color:#f5f5f7;font-family:system-ui,sans-serif">
  <main style="padding:2rem;max-width:40rem">
    <h1 style="font-size:1.4rem;margin:0 0 .5rem">${escapeHtml(TITLE)}</h1>
    <p style="opacity:.75;line-height:1.5;margin:0 0 1rem">${escapeHtml(DESC)}</p>
    <p style="opacity:.5;margin:0 0 1rem">14–15 Aug 2026 · Thiskyhall Sala · Thủ Đức, TP.HCM</p>
    <a href="${PAGE}" style="color:#7eb8ff">Open live map →</a>
  </main>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'HEAD') return res.status(200).end()
  return res.status(200).send(html)
}
