import { SHEET_KOLS } from '../data/sheetKols'
import type { Kol, Niche, StatusLabel } from '../types'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const STORAGE_KEY = 'vn-kol-map-admin-v3'
const STORAGE_VERSION = 3
export const KOLS_EVENT = 'vn-kol-kols-updated'

export interface KolStorePayload {
  version: number
  updatedAt: string
  kols: Kol[]
  note?: string
  source?: string
  count?: number
}

export type KolSource = 'server' | 'local' | 'seed'

export interface LoadKolsResult {
  kols: Kol[]
  source: KolSource
  updatedAt: string | null
}

function kolsApiUrl() {
  return withBase('/api/kols')
}

function cloneSeed(): Kol[] {
  return JSON.parse(JSON.stringify(SHEET_KOLS)) as Kol[]
}

function emitKolsEvent(kols: Kol[]) {
  try {
    window.dispatchEvent(new CustomEvent(KOLS_EVENT, { detail: { kols } }))
  } catch {
    /* ignore */
  }
}

export function loadKolsLocal(): Kol[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneSeed()
    const data = JSON.parse(raw) as KolStorePayload
    if (!data?.kols || !Array.isArray(data.kols) || data.kols.length === 0) {
      return cloneSeed()
    }
    return data.kols
  } catch {
    return cloneSeed()
  }
}

/** Sync load: localStorage → seed. Prefer loadKolsWithSource() for server. */
export function loadKols(): Kol[] {
  return loadKolsLocal()
}

export function saveKolsLocal(kols: Kol[], note?: string): void {
  const payload: KolStorePayload = {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    kols,
    note,
    source: note ? `admin local · ${note}` : 'admin local',
    count: kols.length,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  emitKolsEvent(kols)
}

/** @deprecated use saveKolsLocal or saveKolsToServer */
export function saveKols(kols: Kol[], note?: string): void {
  saveKolsLocal(kols, note)
}

export function clearKolsStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  emitKolsEvent(cloneSeed())
}

export function getStoreMeta(): { updatedAt: string | null; count: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { updatedAt: null, count: 0 }
    const data = JSON.parse(raw) as KolStorePayload
    return { updatedAt: data.updatedAt ?? null, count: data.kols?.length ?? 0 }
  } catch {
    return { updatedAt: null, count: 0 }
  }
}

/** GET /api/kols — null if empty / error. */
export async function fetchServerKols(): Promise<KolStorePayload | null> {
  try {
    const res = await fetch(`${kolsApiUrl()}?t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    const data = (await res.json()) as KolStorePayload
    if (!data?.kols || !Array.isArray(data.kols) || data.kols.length === 0) {
      return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * Load priority:
 * 1) Server R2 (shared for everyone)
 * 2) localStorage
 * 3) seed sheetKols.ts
 */
export async function loadKolsWithSource(): Promise<LoadKolsResult> {
  const server = await fetchServerKols()
  if (server) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...server,
          version: server.version ?? STORAGE_VERSION,
          updatedAt: server.updatedAt || new Date().toISOString(),
          count: server.kols.length,
        }),
      )
    } catch {
      /* ignore */
    }
    return {
      kols: server.kols,
      source: 'server',
      updatedAt: server.updatedAt ?? null,
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as KolStorePayload
      if (data?.kols?.length) {
        return {
          kols: data.kols,
          source: 'local',
          updatedAt: data.updatedAt ?? null,
        }
      }
    }
  } catch {
    /* ignore */
  }

  return { kols: cloneSeed(), source: 'seed', updatedAt: null }
}

export type ServerSaveResult =
  | { ok: true; count: number; updatedAt: string }
  | { ok: false; error: string; status?: number }

/** PUT /api/kols + local mirror. Uses FEED_ADMIN_TOKEN. */
export async function saveKolsToServer(
  kols: Kol[],
  note?: string,
  tokenOverride?: string,
): Promise<ServerSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error:
        'Chưa có admin token — dán FEED_ADMIN_TOKEN (cùng token Feed) vào ô Token.',
    }
  }

  const payload: KolStorePayload = {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    kols,
    note,
    source: note ? `admin server · ${note}` : 'admin server r2',
    count: kols.length,
  }

  try {
    const res = await fetch(kolsApiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
      updatedAt?: string
      count?: number
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          body.message ||
          body.error ||
          `Server ${res.status}${
            res.status === 401
              ? ' — token không khớp FEED_ADMIN_TOKEN trên Vercel'
              : res.status === 503
                ? ' — chưa cấu hình R2 / FEED_ADMIN_TOKEN'
                : ''
          }`,
      }
    }

    // Mirror local for fast reopen
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    emitKolsEvent(kols)
    return {
      ok: true,
      count: body.count ?? kols.length,
      updatedAt: body.updatedAt || payload.updatedAt,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

export function visibleKols(kols: Kol[]): Kol[] {
  return kols.filter((k) => !k.hidden)
}

export function recalculateScores(k: Kol): Kol {
  const base = clamp(Number(k.baseScore) || 50, 0, 100)
  const hot = clamp(Number(k.hotScore) || 50, 0, 100)
  const score = clamp(0.55 * base + 0.45 * hot, 0, 100)
  let activity7dScore = k.activity7dScore
  if (
    k.activity7dPosts != null ||
    k.activity7dLikes != null ||
    k.activity7dViews != null
  ) {
    const posts = k.activity7dPosts ?? 0
    const likes = k.activity7dLikes ?? 0
    const views = k.activity7dViews ?? 0
    activity7dScore = clamp(
      Math.log10(1 + posts) * 28 +
        Math.log10(1 + likes) * 14 +
        Math.log10(1 + views) * 8,
      0,
      100,
    )
  }
  return {
    ...k,
    baseScore: round1(base),
    hotScore: round1(hot),
    score: round1(score),
    activity7dScore:
      activity7dScore != null ? round1(activity7dScore) : undefined,
  }
}

export function createEmptyKol(): Kol {
  const handle = `new_kol_${Date.now().toString(36)}`
  return {
    id: `admin-${handle}`,
    handle,
    displayName: 'New KOL',
    niche: 'Multi',
    niches: ['Multi'],
    tier: 2 as 1 | 2 | 3,
    typeRaw: 'ALL',
    smartFollowers: 50,
    followers: 1000,
    posts24h: 1,
    likes24h: 10,
    replies24h: 1,
    reposts24h: 0,
    baseScore: 40,
    hotScore: 40,
    score: 40,
    deltaPct: 0,
    bio: '[Admin created] Chưa có assessment AI — điền thủ công hoặc chạy sync pipeline.',
    statusLabel: 'stable',
    activityLevel: 40,
    verified: false,
    tweetsTotal: 0,
    tweetsPerDay: 0,
    xFollowing: 0,
    dataSource: 'admin',
    hidden: false,
  }
}

export function exportKolsJson(kols: Kol[]): string {
  return JSON.stringify(
    {
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      count: kols.length,
      kols,
    },
    null,
    2,
  )
}

export function importKolsJson(text: string): Kol[] {
  const data = JSON.parse(text) as { kols?: Kol[] } | Kol[]
  const list = Array.isArray(data) ? data : data.kols
  if (!list || !Array.isArray(list)) throw new Error('Invalid JSON: missing kols[]')
  return list.map((k) => ({
    ...createEmptyKol(),
    ...k,
    id: k.id || `admin-${k.handle}`,
  }))
}

const NICHES: Niche[] = [
  'Trading',
  'Research',
  'News',
  'Airdrop',
  'OTC',
  'DeFi',
  'GameFi',
  'NFT',
  'Meme',
  'Multi',
]

const STATUSES: StatusLabel[] = ['hot', 'active', 'stable', 'quiet', 'dormant']

export function isNiche(v: string): v is Niche {
  return (NICHES as string[]).includes(v)
}

export function isStatus(v: string): v is StatusLabel {
  return (STATUSES as string[]).includes(v)
}

export { NICHES as ADMIN_NICHES, STATUSES as ADMIN_STATUSES }

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
