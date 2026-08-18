import { withBase } from './base'

export type OpsDatasetId =
  | 'feed'
  | 'kols'
  | 'follows'
  | 'scex'
  | 'reports'
  | 'twitterscore'
  | 'banner'
  | 'events'

export type OpsHealthTone = 'ok' | 'warn' | 'stale' | 'error'

export type OpsDatasetSpec = {
  id: OpsDatasetId
  label: string
  r2Key: string
  path: string
  /** Prefer these JSON fields in order (ISO timestamps). */
  timestampFields: string[]
  warnAfterDays: number
  staleAfterDays: number
  cadence: string
}

export const OPS_DATASET_SPECS: OpsDatasetSpec[] = [
  {
    id: 'feed',
    label: 'X Feed',
    r2Key: 'feed/v1.json',
    path: '/api/feed',
    timestampFields: ['generatedAt', 'updatedAt'],
    warnAfterDays: 2,
    staleAfterDays: 3,
    cadence: 'cron daily',
  },
  {
    id: 'kols',
    label: 'KOL list',
    r2Key: 'kols/v1.json',
    path: '/api/kols',
    timestampFields: ['updatedAt'],
    warnAfterDays: 14,
    staleAfterDays: 21,
    cadence: 'admin / scripts',
  },
  {
    id: 'follows',
    label: 'Followers',
    r2Key: 'recent-followers/v1.json',
    path: '/api/recent-followers',
    timestampFields: ['updatedAt'],
    warnAfterDays: 30,
    staleAfterDays: 60,
    cadence: 'radar CLI',
  },
  {
    id: 'scex',
    label: 'SCEX tracking',
    r2Key: 'scex/tracking/v1.json',
    path: '/api/scex-tracking',
    timestampFields: ['updatedAt', 'asOf'],
    warnAfterDays: 10,
    staleAfterDays: 14,
    cadence: 'cron weekly',
  },
  {
    id: 'reports',
    label: 'KOL reports',
    r2Key: 'internal/kol-reports/v1.json',
    path: '/api/kol-reports',
    timestampFields: ['updatedAt', 'asOf'],
    warnAfterDays: 30,
    staleAfterDays: 45,
    cadence: 'admin',
  },
  {
    id: 'twitterscore',
    label: 'TwitterScore',
    r2Key: 'internal/twitterscore-top100/v1.json',
    path: '/api/twitterscore-top100',
    timestampFields: ['updatedAt', 'asOf'],
    warnAfterDays: 21,
    staleAfterDays: 35,
    cadence: 'admin import',
  },
  {
    id: 'banner',
    label: 'Site banner',
    r2Key: 'site/banner/v1.json',
    path: '/api/site-banner',
    timestampFields: ['updatedAt'],
    warnAfterDays: 90,
    staleAfterDays: 180,
    cadence: 'admin',
  },
  {
    id: 'events',
    label: 'Event catalog',
    r2Key: 'events/index.json',
    path: '/api/event-side-events?list=1',
    timestampFields: ['updatedAt'],
    warnAfterDays: 30,
    staleAfterDays: 60,
    cadence: 'admin',
  },
]

export function pickIsoTimestamp(
  body: unknown,
  fields: string[],
): string | null {
  if (!body || typeof body !== 'object') return null
  const rec = body as Record<string, unknown>
  for (const f of fields) {
    const v = rec[f]
    if (typeof v === 'string' && v.trim() && Number.isFinite(Date.parse(v))) {
      return v.trim()
    }
  }
  return null
}

export function ageDays(iso: string, nowMs = Date.now()): number {
  return (nowMs - Date.parse(iso)) / 86_400_000
}

export function opsHealthTone(
  age: number | null,
  warnAfterDays: number,
  staleAfterDays: number,
): OpsHealthTone {
  if (age == null || !Number.isFinite(age)) return 'error'
  if (age >= staleAfterDays) return 'stale'
  if (age >= warnAfterDays) return 'warn'
  return 'ok'
}

export function formatAgeDays(age: number | null): string {
  if (age == null || !Number.isFinite(age)) return '—'
  if (age < 0) return '0h'
  if (age < 1) return `${Math.max(1, Math.round(age * 24))}h`
  if (age < 10) return `${age.toFixed(1)}d`
  return `${Math.round(age)}d`
}

export function opsApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const withTs = `${p}${p.includes('?') ? '&' : '?'}t=${Date.now()}`
  return withBase(withTs)
}
