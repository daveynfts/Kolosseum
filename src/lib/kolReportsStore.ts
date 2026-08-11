/**
 * Client store for KOL evaluation reports (R2 + local cache).
 */
import {
  defaultKolReportsDataset,
  normalizeKolReportsDataset,
  type KolReport,
  type KolReportsDataset,
} from '../data/kolReports'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const STORAGE_KEY = 'vn-kol-reports-v1'
const PUBLIC_CACHE_KEY = 'vn-kol-reports-public-v1'
export const KOL_REPORTS_EVENT = 'vn-kol-reports-updated'

export type KolReportsSource = 'server' | 'cache' | 'seed'

function apiUrl() {
  return withBase('/api/kol-reports')
}

/** In-memory public dataset (shared by Surf AI / map UI) */
let publicCache: { at: number; dataset: KolReportsDataset } | null = null
const PUBLIC_TTL_MS = 60_000

export function loadKolReportsLocal(): KolReportsDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeKolReportsDataset(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveKolReportsLocal(ds: KolReportsDataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ds))
    window.dispatchEvent(
      new CustomEvent(KOL_REPORTS_EVENT, { detail: { dataset: ds } }),
    )
  } catch {
    /* ignore */
  }
}

export function clearKolReportsCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export async function fetchKolReportsAdmin(
  token?: string,
): Promise<KolReportsDataset | null> {
  const t = (token ?? getAdminToken()).trim()
  try {
    const res = await fetch(`${apiUrl()}?all=1&t=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    return normalizeKolReportsDataset(await res.json())
  } catch {
    return null
  }
}

export async function fetchKolReportsPublic(opts?: {
  force?: boolean
}): Promise<KolReportsDataset | null> {
  const force = !!opts?.force
  if (!force && publicCache && Date.now() - publicCache.at < PUBLIC_TTL_MS) {
    return publicCache.dataset
  }
  try {
    const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404 || res.status === 503) {
      // session fallback
      try {
        const raw = sessionStorage.getItem(PUBLIC_CACHE_KEY)
        if (raw) {
          const ds = normalizeKolReportsDataset(JSON.parse(raw))
          if (ds) {
            publicCache = { at: Date.now(), dataset: ds }
            return ds
          }
        }
      } catch {
        /* ignore */
      }
      return null
    }
    if (!res.ok) return null
    const ds = normalizeKolReportsDataset(await res.json())
    if (ds) {
      publicCache = { at: Date.now(), dataset: ds }
      try {
        sessionStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(ds))
      } catch {
        /* ignore */
      }
    }
    return ds
  } catch {
    return null
  }
}

/** Latest public report for a map handle (case-insensitive). */
export function findPublicReportByHandle(
  dataset: KolReportsDataset | null | undefined,
  handle: string,
): KolReport | null {
  if (!dataset?.reports?.length) return null
  const h = handle.replace(/^@/, '').trim().toLowerCase()
  if (!h) return null
  const matches = dataset.reports.filter(
    (r) =>
      !r.deletedAt &&
      r.visibility === 'public' &&
      r.handle.toLowerCase() === h,
  )
  if (!matches.length) return null
  matches.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  return matches[0]
}

export async function loadPublicReportForHandle(
  handle: string,
  opts?: { force?: boolean },
): Promise<KolReport | null> {
  const ds = await fetchKolReportsPublic(opts)
  return findPublicReportByHandle(ds, handle)
}

/** Invalidate public cache after admin publish/save (optional call). */
export function invalidatePublicKolReportsCache(): void {
  publicCache = null
  try {
    sessionStorage.removeItem(PUBLIC_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export async function loadKolReportsWithSource(
  token?: string,
): Promise<{ dataset: KolReportsDataset; source: KolReportsSource }> {
  const server = await fetchKolReportsAdmin(token)
  if (server) {
    saveKolReportsLocal(server)
    return { dataset: server, source: 'server' }
  }
  const local = loadKolReportsLocal()
  if (local) return { dataset: local, source: 'cache' }
  const t = (token ?? getAdminToken()).trim()
  if (t) {
    const { adminSeedKolReportsDataset } = await import('../data/kolReportsAdminSeed')
    return { dataset: adminSeedKolReportsDataset(), source: 'seed' }
  }
  return { dataset: defaultKolReportsDataset(), source: 'seed' }
}

export async function saveKolReportsToServer(
  dataset: KolReportsDataset,
  token?: string,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const t = (token ?? getAdminToken()).trim()
  if (!t) return { ok: false, status: 0, message: 'Missing admin token' }
  let baseUpdatedAt: string | undefined
  try {
    const server = await fetchKolReportsAdmin(t)
    baseUpdatedAt = server?.updatedAt
  } catch {
    /* ignore */
  }
  const payload: KolReportsDataset & { baseUpdatedAt?: string } = {
    ...dataset,
    kind: 'kol-reports' as const,
    version: dataset.version || 1,
    updatedAt: new Date().toISOString(),
    trash: dataset.trash || [],
    baseUpdatedAt,
  }
  try {
    const res = await fetch(apiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
      let message = text.slice(0, 200)
      try {
        const j = JSON.parse(text) as { message?: string; error?: string }
        if (res.status === 409) {
          message =
            j.message ||
            'Server có bản mới hơn — Reload rồi Save lại.'
        } else {
          message = j.message || j.error || message
        }
      } catch {
        /* keep text slice */
      }
      return {
        ok: false,
        status: res.status,
        message,
      }
    }
    saveKolReportsLocal(payload)
    // Public map/Surf AI must see latest publish flags
    invalidatePublicKolReportsCache()
    return { ok: true, status: res.status }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

export function exportKolReportsJson(ds: KolReportsDataset): string {
  return JSON.stringify(ds, null, 2)
}

export function importKolReportsJson(raw: string): KolReportsDataset | null {
  try {
    return normalizeKolReportsDataset(JSON.parse(raw))
  } catch {
    return null
  }
}
