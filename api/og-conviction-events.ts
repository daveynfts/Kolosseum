/**
 * OG image endpoint — redirects to the static share card PNG/JPG.
 * Keeps old /api/og-conviction-events links working after removing the edge TSX handler.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
  res.setHeader('Access-Control-Allow-Origin', '*')
  // 302 so Telegram/Facebook fetch the static image URL
  res.redirect(302, 'https://radar.daveynfts.com/og/conviction-2026-events.jpg')
}
