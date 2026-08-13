/**
 * Internal TwitterScore Top 100 — R2 first, then seed JSON.
 * Admin edits publish to R2; map/agent read via getTwitterScoreDataset().
 */
import {
  TWITTER_SCORE_SEED,
  normalizeTwitterScoreDataset,
  recomputeTwitterScoreStats,
  type TwitterScoreAccount,
  type TwitterScoreDataset,
} from '../data/twitterScoreTop100'
import { withBase } from './base'
import { getAdminToken } from './feedStore'

const CACHE_KEY = 'vn-kol-map-twitterscore-top100-v1'
export const TWITTER_SCORE_EVENT = 'vn-kol-twitterscore-updated'

function apiUrl() {
  return withBase('/api/twitterscore-top100')
}

function emit() {
  try {
    window.dispatchEvent(new Event(TWITTER_SCORE_EVENT))
  } catch {
    /* ignore */
  }
}

function writeCache(dataset: TwitterScoreDataset) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataset))
  } catch {
    /* ignore */
  }
  emit()
}

function readCache(): TwitterScoreDataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return normalizeTwitterScoreDataset(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Sync: cache → seed. Prefer loadTwitterScoreWithSource(). */
export function getTwitterScoreDataset(): TwitterScoreDataset {
  return readCache() || TWITTER_SCORE_SEED
}

export function getTwitterScoreAccounts(): TwitterScoreAccount[] {
  return getTwitterScoreDataset().accounts
}

export async function fetchServerTwitterScore(): Promise<TwitterScoreDataset | null> {
  const res = await fetch(`${apiUrl()}?t=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  })
  if (res.status === 404 || res.status === 503) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return normalizeTwitterScoreDataset(await res.json())
}

export type LoadTwitterScoreResult = {
  dataset: TwitterScoreDataset
  source: 'server' | 'cache' | 'seed'
}

export async function loadTwitterScoreWithSource(): Promise<LoadTwitterScoreResult> {
  try {
    const server = await fetchServerTwitterScore()
    if (server) {
      writeCache(server)
      return { dataset: server, source: 'server' }
    }
  } catch {
    /* cache/seed */
  }
  const cache = readCache()
  if (cache) return { dataset: cache, source: 'cache' }
  return { dataset: TWITTER_SCORE_SEED, source: 'seed' }
}

export type TwitterScoreSaveResult =
  | { ok: true; dataset: TwitterScoreDataset; updatedAt: string }
  | { ok: false; error: string; status?: number }

export async function saveTwitterScoreToServer(
  dataset: TwitterScoreDataset,
  note?: string,
  tokenOverride?: string,
): Promise<TwitterScoreSaveResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN rồi Apply token.',
    }
  }
  const next = recomputeTwitterScoreStats({
    ...dataset,
    updatedAt: new Date().toISOString(),
    note: note || dataset.note,
  })
  let baseUpdatedAt: string | undefined
  try {
    const server = await fetchServerTwitterScore()
    baseUpdatedAt = server?.updatedAt
  } catch {
    return {
      ok: false,
      error: 'Không đọc được bản server — thử lại trước khi Save.',
    }
  }
  try {
    const res = await fetch(apiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...next, baseUpdatedAt }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
      updatedAt?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          body.message ||
          body.error ||
          `Server ${res.status}${
            res.status === 409
              ? ' — server có TwitterScore mới hơn, Reload rồi Save'
              : ''
          }`,
      }
    }
    const saved = {
      ...next,
      updatedAt: body.updatedAt || next.updatedAt,
    }
    writeCache(saved)
    return {
      ok: true,
      dataset: saved,
      updatedAt: saved.updatedAt || new Date().toISOString(),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    }
  }
}

export function clearTwitterScoreCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

export function exportTwitterScoreJson(dataset: TwitterScoreDataset): string {
  return JSON.stringify(recomputeTwitterScoreStats(dataset), null, 2) + '\n'
}

export function importTwitterScoreJson(text: string): TwitterScoreDataset {
  const parsed = normalizeTwitterScoreDataset(JSON.parse(text))
  if (!parsed) throw new Error('Invalid TwitterScore dataset JSON')
  return parsed
}

export function seedTwitterScoreDataset(): TwitterScoreDataset {
  return structuredClone(TWITTER_SCORE_SEED)
}
