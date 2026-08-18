/**
 * Hobby-plan binary/media — one serverless function (bodyParser off).
 * Public URLs stay /api/media, /api/avatar, … via vercel.json rewrites (?route=).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { apiRouteName, isBinRoute } from '../lib/server/apiRoute.js'
import media from '../lib/server/handlers/media.js'
import avatar from '../lib/server/handlers/avatar.js'
import xStatus from '../lib/server/handlers/x-status.js'
import kolReportImage from '../lib/server/handlers/kol-report-image.js'
import siteBanner from '../lib/server/handlers/site-banner.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const HANDLERS = {
  media,
  avatar,
  'x-status': xStatus,
  'kol-report-image': kolReportImage,
  'site-banner': siteBanner,
} as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = apiRouteName(req)
  if (!isBinRoute(name)) {
    return res.status(404).json({
      error: 'not_found',
      message: `Unknown binary API route${name ? `: ${name}` : ''}`,
    })
  }
  return HANDLERS[name](req, res)
}
