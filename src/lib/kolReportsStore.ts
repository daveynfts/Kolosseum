/**
 * Client store for KOL evaluation reports (R2 + local cache).
 */
import {
  defaultKolReportsDataset,
  normalizeKolReportsDataset,
  type KolReportsDataset,
} from '../data/kolReports'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const STORAGE_KEY = 'vn-kol-reports-v1'
export const KOL_REPORTS_EVENT = 'vn-kol-reports-updated'

export type KolReportsSource = 'server' | 'cache' | 'seed'

function apiUrl() {
  return withBase('/api/kol-reports')
}

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

export async function fetchKolReportsPublic(): Promise<KolReportsDataset | null> {
  try {
    const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    return normalizeKolReportsDataset(await res.json())
  } catch {
    return null
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
  return { dataset: defaultKolReportsDataset(), source: 'seed' }
}

export async function saveKolReportsToServer(
  dataset: KolReportsDataset,
  token?: string,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const t = (token ?? getAdminToken()).trim()
  if (!t) return { ok: false, status: 0, message: 'Missing admin token' }
  const payload: KolReportsDataset = {
    ...dataset,
    kind: 'kol-reports' as const,
    version: dataset.version || 1,
    updatedAt: new Date().toISOString(),
    trash: dataset.trash || [],
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
      return {
        ok: false,
        status: res.status,
        message: text.slice(0, 200),
      }
    }
    saveKolReportsLocal(payload)
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
