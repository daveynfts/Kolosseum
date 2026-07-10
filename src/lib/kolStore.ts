import { SHEET_KOLS } from '../data/sheetKols'
import type { Kol, Niche, StatusLabel } from '../types'

const STORAGE_KEY = 'vn-kol-map-admin-v3'
const STORAGE_VERSION = 3

export interface KolStorePayload {
  version: number
  updatedAt: string
  kols: Kol[]
  note?: string
}

function cloneSeed(): Kol[] {
  return JSON.parse(JSON.stringify(SHEET_KOLS)) as Kol[]
}

export function loadKols(): Kol[] {
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

export function saveKols(kols: Kol[], note?: string): void {
  const payload: KolStorePayload = {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    kols,
    note,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearKolsStore(): void {
  localStorage.removeItem(STORAGE_KEY)
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
  return list.map((k) => ({ ...createEmptyKol(), ...k, id: k.id || `admin-${k.handle}` }))
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
