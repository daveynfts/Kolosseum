/**
 * Hobby-plan JSON CRUD — one serverless function.
 * Public URLs stay /api/feed, /api/kols, … via vercel.json rewrites (?route=).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { apiRouteName, isJsonRoute } from '../lib/server/apiRoute.js'
import feed from '../lib/server/handlers/feed.js'
import kols from '../lib/server/handlers/kols.js'
import scexTracking from '../lib/server/handlers/scex-tracking.js'
import kolReports from '../lib/server/handlers/kol-reports.js'
import recentFollowers from '../lib/server/handlers/recent-followers.js'
import twitterscoreTop100 from '../lib/server/handlers/twitterscore-top100.js'
import eventSideEvents from '../lib/server/handlers/event-side-events.js'

const HANDLERS = {
  feed,
  kols,
  'scex-tracking': scexTracking,
  'kol-reports': kolReports,
  'recent-followers': recentFollowers,
  'twitterscore-top100': twitterscoreTop100,
  'event-side-events': eventSideEvents,
} as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = apiRouteName(req)
  if (!isJsonRoute(name)) {
    return res.status(404).json({
      error: 'not_found',
      message: `Unknown JSON API route${name ? `: ${name}` : ''}`,
    })
  }
  return HANDLERS[name](req, res)
}
