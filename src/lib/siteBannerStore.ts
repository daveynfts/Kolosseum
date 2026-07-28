/**
 * Partner event ribbon — R2 first, then cache, then seed defaults.
 */
import {
  normalizeSiteBanner,
  SITE_BANNER_SEED,
  type SiteBannerConfig,
} from '../data/siteBanner'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const CACHE_KEY = 'vn-kol-map-site-banner-v1'
export const SITE_BANNER_EVENT = 'vn-kol-site-banner-updated'

function apiUrl() {
  return withBase('/api/site-banner')
}

function emit() {
  try {
    window.dispatchEvent(new Event(SITE_BANNER_EVENT))
  } catch {
    /* ignore */
  }
}

function writeCache(config: SiteBannerConfig) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
  emit()
}

function readCache(): SiteBannerConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return normalizeSiteBanner(JSON.parse(raw))
  } catch {
    return null
  }
}

export function getSiteBanner(): SiteBannerConfig {
  return readCache() || SITE_BANNER_SEED
}

export function seedSiteBanner(): SiteBannerConfig {
  return normalizeSiteBanner(JSON.parse(JSON.stringify(SITE_BANNER_SEED)))
}

export async function fetchServerSiteBanner(): Promise<SiteBannerConfig | null> {
  try {
    const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (res.status === 404 || res.status === 503) return null
    if (!res.ok) return null
    return normalizeSiteBanner(await res.json())
  } catch {
    return null
  }
}

export type LoadSiteBannerResult = {
  config: SiteBannerConfig
  source: 'server' | 'cache' | 'seed'
}

export async function loadSiteBannerWithSource(): Promise<LoadSiteBannerResult> {
  const server = await fetchServerSiteBanner()
  if (server) {
    writeCache(server)
    return { config: server, source: 'server' }
  }
  const cache = readCache()
  if (cache) return { config: cache, source: 'cache' }
  return { config: seedSiteBanner(), source: 'seed' }
}

export type SiteBannerSaveResult =
  | { ok: true; config: SiteBannerConfig; updatedAt: string }
  | { ok: false; error: string; status?: number }

export async function saveSiteBannerToServer(
  config: SiteBannerConfig,
  note?: string,
  tokenOverride?: string,
): Promise<SiteBannerSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return { ok: false, error: 'Missing FEED_ADMIN_TOKEN — Apply token first' }
  }

  let baseUpdatedAt: string | undefined
  try {
    const server = await fetchServerSiteBanner()
    baseUpdatedAt = server?.updatedAt
  } catch {
    /* ignore */
  }

  const payload = {
    ...normalizeSiteBanner(config),
    note: note ?? config.note ?? 'admin site banner',
    updatedAt: new Date().toISOString(),
    baseUpdatedAt,
  }

  try {
    const res = await fetch(apiUrl(), {
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
          res.status === 409
            ? j.message || 'Server có banner mới hơn — Reload rồi Save lại.'
            : j.message || j.error || res.statusText,
        status: res.status,
      }
    }
    const saved = normalizeSiteBanner({
      ...payload,
      updatedAt: j.updatedAt || payload.updatedAt,
    })
    writeCache(saved)
    return {
      ok: true,
      config: saved,
      updatedAt: saved.updatedAt || new Date().toISOString(),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function clearSiteBannerCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

export function exportSiteBannerJson(config: SiteBannerConfig): string {
  return JSON.stringify(normalizeSiteBanner(config), null, 2)
}

export function importSiteBannerJson(text: string): SiteBannerConfig {
  return normalizeSiteBanner(JSON.parse(text))
}
