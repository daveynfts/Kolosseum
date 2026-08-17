/**
 * Side-event maps — R2 first, then seed.
 *
 *   GET/PUT /api/event-side-events?event=<slug>
 *   R2 key: events/<slug>/v1.json
 *
 * Conviction 2026 stays on events/conviction-2026/v1.json so next year's
 * clone cannot overwrite the archive.
 */
import {
  CONVICTION_EVENTS_SEED,
  emptyEditionDataset,
  normalizeDataset,
  type SideEventDataset,
} from '../data/convictionEvents'
import {
  DEFAULT_EVENT_SLUG,
  mergeEditionCatalog,
  parseEventSlug,
  type EventEditionMeta,
} from '../data/eventEditions'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

function cacheKey(slug: string) {
  return `vn-kol-map-event:${slug}:v1`
}

/** Legacy single-edition cache — migrate into the slug key once. */
const LEGACY_CACHE_KEY = 'vn-kol-map-conviction-events-v5'

export const CONVICTION_EVENTS_EVENT = 'vn-kol-conviction-events-updated'

function resolveSlug(slug?: string | null): string {
  return parseEventSlug(slug) || DEFAULT_EVENT_SLUG
}

export function eventsApiUrl(
  slug?: string | null,
  extra?: Record<string, string>,
): string {
  const qs = new URLSearchParams({ event: resolveSlug(slug), ...extra })
  return `${withBase('/api/event-side-events')}?${qs}`
}

export function editionsIndexApiUrl(): string {
  return `${withBase('/api/event-side-events')}?list=1`
}

export async function fetchEditionCatalog(): Promise<EventEditionMeta[]> {
  try {
    const res = await fetch(`${editionsIndexApiUrl()}&t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return mergeEditionCatalog(null)
    return mergeEditionCatalog(await res.json())
  } catch {
    return mergeEditionCatalog(null)
  }
}

function emit() {
  try {
    window.dispatchEvent(new Event(CONVICTION_EVENTS_EVENT))
  } catch {
    /* ignore */
  }
}

function writeCache(
  dataset: SideEventDataset,
  emitEvent = true,
  slug = dataset.event,
) {
  const key = cacheKey(resolveSlug(slug))
  let prev: string | null = null
  try {
    prev = localStorage.getItem(key)
  } catch {
    prev = null
  }
  const publicView = normalizeDataset(dataset, {
    fallbackSlug: resolveSlug(slug),
  })
  const next = JSON.stringify(publicView || dataset)
  try {
    localStorage.setItem(key, next)
  } catch {
    /* ignore */
  }
  if (emitEvent && prev !== next) emit()
}

function readCache(slug?: string | null): SideEventDataset | null {
  const s = resolveSlug(slug)
  try {
    const raw = localStorage.getItem(cacheKey(s))
    if (raw) return normalizeDataset(JSON.parse(raw), { fallbackSlug: s })
    if (s === DEFAULT_EVENT_SLUG) {
      const legacy = localStorage.getItem(LEGACY_CACHE_KEY)
      if (legacy) {
        const n = normalizeDataset(JSON.parse(legacy), { fallbackSlug: s })
        if (n) {
          try {
            localStorage.setItem(cacheKey(s), JSON.stringify(n))
          } catch {
            /* ignore */
          }
          return n
        }
      }
    }
    return null
  } catch {
    return null
  }
}

export function getConvictionEvents(
  slug?: string | null,
): SideEventDataset {
  const s = resolveSlug(slug)
  return (
    readCache(s) ||
    seedConvictionEvents(false, s)
  )
}

export function seedConvictionEvents(
  includeHidden = false,
  slug?: string | null,
): SideEventDataset {
  const s = resolveSlug(slug)
  if (s === DEFAULT_EVENT_SLUG) {
    return normalizeDataset(
      JSON.parse(JSON.stringify(CONVICTION_EVENTS_SEED)),
      { includeHidden, fallbackSlug: s },
    ) as SideEventDataset
  }
  return emptyEditionDataset(s)
}

export async function fetchServerEvents(
  opts: { includeHidden?: boolean; slug?: string | null } = {},
): Promise<SideEventDataset | null> {
  const includeHidden = opts.includeHidden === true
  const slug = resolveSlug(opts.slug)
  const token = includeHidden ? getAdminToken().trim() : ''
  const extra: Record<string, string> = { t: String(Date.now()) }
  if (includeHidden) extra.all = '1'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(eventsApiUrl(slug, extra), {
    method: 'GET',
    cache: 'no-store',
    headers,
  })
  if (res.status === 404 || res.status === 503) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return normalizeDataset(await res.json(), {
    includeHidden,
    fallbackSlug: slug,
  })
}

export type LoadEventsResult = {
  dataset: SideEventDataset
  source: 'server' | 'cache' | 'seed'
}

export async function loadEventsWithSource(
  opts: { includeHidden?: boolean; slug?: string | null } = {},
): Promise<LoadEventsResult> {
  const slug = resolveSlug(opts.slug)
  try {
    const server = await fetchServerEvents(opts)
    if (server) {
      writeCache(server, false, slug)
      return { dataset: server, source: 'server' }
    }
  } catch {
    /* fall through */
  }
  if (!opts.includeHidden) {
    const cache = readCache(slug)
    if (cache) return { dataset: cache, source: 'cache' }
  }
  return {
    dataset: seedConvictionEvents(opts.includeHidden === true, slug),
    source: 'seed',
  }
}

export type EventsSaveResult =
  | { ok: true; dataset: SideEventDataset; updatedAt: string }
  | { ok: false; error: string; status?: number }

export async function saveEventsToServer(
  dataset: SideEventDataset,
  tokenOverride?: string,
  slugOverride?: string | null,
): Promise<EventsSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return { ok: false, error: 'Missing FEED_ADMIN_TOKEN — Apply token first' }
  }

  const slug = resolveSlug(slugOverride || dataset.event)

  let baseUpdatedAt: string | undefined
  try {
    const server = await fetchServerEvents({
      includeHidden: true,
      slug,
    })
    baseUpdatedAt = server?.updatedAt
  } catch {
    return {
      ok: false,
      error: 'Không đọc được bản server — thử lại trước khi Save.',
    }
  }

  const normalized = normalizeDataset(
    {
      ...dataset,
      version: 1,
      event: slug,
      updatedAt: new Date().toISOString(),
    },
    { includeHidden: true, fallbackSlug: slug },
  )
  if (!normalized) {
    return { ok: false, error: 'Invalid dataset' }
  }

  const payload = {
    ...normalized,
    baseUpdatedAt,
  }

  try {
    const res = await fetch(eventsApiUrl(slug), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const j = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
      updatedAt?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401
            ? 'Unauthorized — kiểm tra FEED_ADMIN_TOKEN (Apply token rồi Save lại).'
            : res.status === 409
              ? j.message ||
                'Server có Events mới hơn — Reload rồi Save lại.'
              : j.message || j.error || res.statusText,
        status: res.status,
      }
    }
    const saved: SideEventDataset = {
      ...normalized,
      updatedAt: j.updatedAt || normalized.updatedAt,
    }
    writeCache(saved, true, slug)
    return {
      ok: true,
      dataset: saved,
      updatedAt: saved.updatedAt,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function clearEventsCache(slug?: string | null) {
  const s = parseEventSlug(slug)
  try {
    if (s) {
      localStorage.removeItem(cacheKey(s))
      if (s === DEFAULT_EVENT_SLUG) localStorage.removeItem(LEGACY_CACHE_KEY)
    } else {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('vn-kol-map-event:')) keys.push(k)
      }
      for (const k of keys) localStorage.removeItem(k)
      localStorage.removeItem(LEGACY_CACHE_KEY)
    }
  } catch {
    /* ignore */
  }
  emit()
}

export function exportEventsJson(dataset: SideEventDataset): string {
  return JSON.stringify(
    normalizeDataset(dataset, {
      includeHidden: true,
      fallbackSlug: dataset.event,
    }),
    null,
    2,
  )
}

export function importEventsJson(
  text: string,
  fallbackSlug?: string | null,
): SideEventDataset {
  const n = normalizeDataset(JSON.parse(text), {
    includeHidden: true,
    fallbackSlug: fallbackSlug || undefined,
  })
  if (!n) throw new Error('Invalid Events JSON')
  return n
}
