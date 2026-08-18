/**
 * Hobby-plan binary/media — one serverless function (bodyParser off).
 * Public URLs stay /api/media, /api/avatar, … via vercel.json rewrites (?route=).
 *
 * Handlers load on demand so a heavy route cannot take down media/avatar
 * during module init (same pattern as api/json.ts).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  apiRouteName,
  isBinRoute,
  type BinRoute,
} from '../lib/server/apiRoute.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>

const LOADERS: Record<BinRoute, () => Promise<{ default: ApiHandler }>> = {
  media: () => import('../lib/server/handlers/media.js'),
  avatar: () => import('../lib/server/handlers/avatar.js'),
  'x-status': () => import('../lib/server/handlers/x-status.js'),
  'kol-report-image': () =>
    import('../lib/server/handlers/kol-report-image.js'),
  'site-banner': () => import('../lib/server/handlers/site-banner.js'),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = apiRouteName(req)
  if (!isBinRoute(name)) {
    return res.status(404).json({
      error: 'not_found',
      message: `Unknown binary API route${name ? `: ${name}` : ''}`,
    })
  }
  const { default: run } = await LOADERS[name]()
  return run(req, res)
}
