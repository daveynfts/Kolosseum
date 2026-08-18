/**
 * Hobby-plan JSON CRUD — one serverless function.
 * Public URLs stay /api/feed, /api/kols, … via vercel.json rewrites (?route=).
 *
 * Handlers load on demand so a heavy route (SCEX) cannot take down feed/kols
 * during module init, and Vercel does not parse the SCEX seed on every JSON call.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  apiRouteName,
  isJsonRoute,
  type JsonRoute,
} from '../lib/server/apiRoute.js'

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>

const LOADERS: Record<JsonRoute, () => Promise<{ default: ApiHandler }>> = {
  feed: () => import('../lib/server/handlers/feed.js'),
  kols: () => import('../lib/server/handlers/kols.js'),
  'scex-tracking': () => import('../lib/server/handlers/scex-tracking.js'),
  'kol-reports': () => import('../lib/server/handlers/kol-reports.js'),
  'recent-followers': () => import('../lib/server/handlers/recent-followers.js'),
  'twitterscore-top100': () =>
    import('../lib/server/handlers/twitterscore-top100.js'),
  'event-side-events': () =>
    import('../lib/server/handlers/event-side-events.js'),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = apiRouteName(req)
  if (!isJsonRoute(name)) {
    return res.status(404).json({
      error: 'not_found',
      message: `Unknown JSON API route${name ? `: ${name}` : ''}`,
    })
  }
  const { default: run } = await LOADERS[name]()
  return run(req, res)
}
