import type { VercelRequest } from '@vercel/node'

const ALIAS: Record<string, string> = {
  'banner-image': 'site-banner',
  'surf-report': 'kol-report-image',
}

export const JSON_ROUTES = [
  'feed',
  'kols',
  'scex-tracking',
  'kol-reports',
  'recent-followers',
  'twitterscore-top100',
  'event-side-events',
] as const

export const BIN_ROUTES = [
  'media',
  'avatar',
  'x-status',
  'kol-report-image',
  'site-banner',
] as const

export type JsonRoute = (typeof JSON_ROUTES)[number]
export type BinRoute = (typeof BIN_ROUTES)[number]

function firstQuery(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim()
  return ''
}

function lastPathSegment(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  return (parts[parts.length - 1] || '').toLowerCase()
}

/**
 * Resolve the logical API route after vercel.json rewrites to /api/json or /api/bin.
 * Prefers ?route=, then the last /api/… segment (aliases: banner-image, surf-report).
 */
export function apiRouteName(req: Pick<VercelRequest, 'query' | 'url'>): string {
  const fromQuery = firstQuery(req.query?.route).toLowerCase()
  if (fromQuery && fromQuery !== 'json' && fromQuery !== 'bin') {
    return ALIAS[fromQuery] || fromQuery
  }
  const path = String(req.url || '').split('?')[0]
  const seg = lastPathSegment(path)
  if (!seg || seg === 'json' || seg === 'bin') return ''
  return ALIAS[seg] || seg
}

export function isJsonRoute(name: string): name is JsonRoute {
  return (JSON_ROUTES as readonly string[]).includes(name)
}

export function isBinRoute(name: string): name is BinRoute {
  return (BIN_ROUTES as readonly string[]).includes(name)
}
