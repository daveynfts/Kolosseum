/**
 * SCEX partner tracking — quadrant matrix + livefeed.
 * Seed: src/data/internal/scex-tracking.json
 * Runtime: R2 scex/tracking/v1.json via GET/PUT /api/scex-tracking
 */
import seedJson from './internal/scex-tracking.json'

export type ScexSentiment =
  | 'bullish'
  | 'bearish'
  | 'shill'
  | 'scam'
  | 'neutral'

export type ScexQuadrant = 'stars' | 'nurture' | 'noise' | 'ignore'

export type ScexActorKind = 'kol' | 'user'

export type ScexSizeMetric = 'followers' | 'reach7d'

export interface ScexAxisConfig {
  min: number
  max: number
  label: string
}

export interface ScexQuadrantLabel {
  title: string
  subtitle: string
}

export interface ScexSentimentLabel {
  label: string
  color: string
}

export interface ScexConfig {
  brandName: string
  brandHandle: string
  /** Keywords / handles / domains that count as SCEX mention */
  keywords: string[]
  timeWindowDays: number
  /** KOL: min posts in window to appear (default 1) */
  kolMinPosts: number
  /** Organic user thresholds */
  userMinPosts: number
  userMinFollowers: number
  userMinQuality: number
  volumeAxis: ScexAxisConfig
  qualityAxis: ScexAxisConfig
  sizeMetric: ScexSizeMetric
  /** Split X (volume) for 4 quadrants */
  volumeSplit: number
  /** Split Y (quality 0–100) */
  qualitySplit: number
  quadrantLabels: Record<ScexQuadrant, ScexQuadrantLabel>
  sentimentLabels: Record<ScexSentiment, ScexSentimentLabel>
  matrixTitle: string
  feedTitle: string
  enabled: boolean
}

export interface ScexActor {
  id: string
  handle: string
  displayName: string
  kind: ScexActorKind
  /** Radar tier or free text */
  tier?: string
  followers: number
  reach7d?: number
  /** Posts mentioning SCEX in window */
  postsVolume: number
  /** Quality engagement score 0–100 */
  qualityScore: number
  sentiment: ScexSentiment
  sentimentConfidence?: number
  quadrant?: ScexQuadrant
  isWhitelisted?: boolean
  isDenylisted?: boolean
  notes?: string
  lastPostAt?: string
  trackingCode?: string
  tags?: string
}

export interface ScexPost {
  id: string
  handle: string
  url: string
  text: string
  postedAt: string
  sentiment: ScexSentiment
  likes?: number
  replies?: number
  reposts?: number
  views?: number
  /** Image URLs (R2-cached or remote) — same shape as main feed */
  media?: string[]
  hidden?: boolean
  notes?: string
}

export interface ScexDataset {
  version: number
  kind: string
  asOf: string
  updatedAt?: string
  note?: string
  config: ScexConfig
  actors: ScexActor[]
  posts: ScexPost[]
}

const DEFAULT_SENTIMENT: Record<ScexSentiment, ScexSentimentLabel> = {
  bullish: { label: 'Tích cực', color: '#22c55e' },
  bearish: { label: 'Tiêu cực', color: '#ef4444' },
  shill: { label: 'Shill', color: '#f59e0b' },
  scam: { label: 'Cảnh báo scam', color: '#dc2626' },
  neutral: { label: 'Trung lập', color: '#94a3b8' },
}

const DEFAULT_QUAD: Record<ScexQuadrant, ScexQuadrantLabel> = {
  stars: {
    title: 'NGÔI SAO',
    subtitle: 'Nói nhiều · chất lượng cao — ưu tiên hợp tác',
  },
  nurture: {
    title: 'CẦN NUÔI',
    subtitle: 'Chất lượng cao · ít bài — mời đăng thêm',
  },
  noise: {
    title: 'ỒN ÀO',
    subtitle: 'Nhiều bài · chất lượng thấp — cần lọc',
  },
  ignore: {
    title: 'THẤP',
    subtitle: 'Ít tín hiệu — để sau / lưu trữ',
  },
}

export function defaultScexConfig(): ScexConfig {
  return {
    brandName: 'SCEX',
    brandHandle: 'scex',
    keywords: ['SCEX', '@scex'],
    timeWindowDays: 7,
    kolMinPosts: 1,
    userMinPosts: 3,
    userMinFollowers: 5000,
    userMinQuality: 40,
    volumeAxis: { min: 0, max: 20, label: 'Số lần nhắc' },
    qualityAxis: { min: 0, max: 100, label: 'Điểm chất lượng' },
    sizeMetric: 'followers',
    volumeSplit: 5,
    qualitySplit: 50,
    quadrantLabels: { ...DEFAULT_QUAD },
    sentimentLabels: { ...DEFAULT_SENTIMENT },
    matrixTitle: 'Ma trận mention SCEX',
    feedTitle: 'Bảng tin X · SCEX',
    enabled: true,
  }
}

export function computeQuadrant(
  volume: number,
  quality: number,
  volumeSplit: number,
  qualitySplit: number,
): ScexQuadrant {
  const highVol = volume >= volumeSplit
  const highQ = quality >= qualitySplit
  if (highVol && highQ) return 'stars'
  if (!highVol && highQ) return 'nurture'
  if (highVol && !highQ) return 'noise'
  return 'ignore'
}

export function actorPassesThresholds(
  actor: ScexActor,
  config: ScexConfig,
): boolean {
  if (actor.isDenylisted) return false
  if (actor.isWhitelisted) return true
  if (actor.kind === 'kol') {
    return actor.postsVolume >= (config.kolMinPosts ?? 1)
  }
  return (
    actor.postsVolume >= config.userMinPosts &&
    actor.followers >= config.userMinFollowers &&
    actor.qualityScore >= config.userMinQuality
  )
}

function normalizeSentiment(raw: unknown): ScexSentiment {
  const s = String(raw || 'neutral').toLowerCase()
  if (
    s === 'bullish' ||
    s === 'bearish' ||
    s === 'shill' ||
    s === 'scam' ||
    s === 'neutral'
  )
    return s
  return 'neutral'
}

function normalizeActor(raw: unknown, i: number): ScexActor | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const handle = String(o.handle || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase()
  if (!handle) return null
  const kind: ScexActorKind = o.kind === 'user' ? 'user' : 'kol'
  return {
    id: String(o.id || `actor_${handle}_${i}`),
    handle,
    displayName: String(o.displayName || handle).trim() || handle,
    kind,
    tier: o.tier != null ? String(o.tier) : undefined,
    followers: Number(o.followers) || 0,
    reach7d: o.reach7d != null ? Number(o.reach7d) || 0 : undefined,
    postsVolume: Number(o.postsVolume) || 0,
    qualityScore: Math.min(100, Math.max(0, Number(o.qualityScore) || 0)),
    sentiment: normalizeSentiment(o.sentiment),
    sentimentConfidence:
      o.sentimentConfidence != null
        ? Number(o.sentimentConfidence)
        : undefined,
    quadrant: o.quadrant as ScexQuadrant | undefined,
    isWhitelisted: !!o.isWhitelisted,
    isDenylisted: !!o.isDenylisted,
    notes: o.notes != null ? String(o.notes) : undefined,
    lastPostAt: o.lastPostAt != null ? String(o.lastPostAt) : undefined,
    trackingCode: o.trackingCode != null ? String(o.trackingCode) : undefined,
    tags: o.tags != null ? String(o.tags) : undefined,
  }
}

function normalizePost(raw: unknown, i: number): ScexPost | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const handle = String(o.handle || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase()
  if (!handle) return null
  const media = Array.isArray(o.media)
    ? o.media.map((m) => String(m || '').trim()).filter(Boolean)
    : undefined
  return {
    id: String(o.id || `post_${i}_${handle}`),
    handle,
    url: String(o.url || '').trim(),
    text: String(o.text || '').trim(),
    postedAt: String(o.postedAt || new Date().toISOString()),
    sentiment: normalizeSentiment(o.sentiment),
    likes: o.likes != null ? Number(o.likes) || 0 : undefined,
    replies: o.replies != null ? Number(o.replies) || 0 : undefined,
    reposts: o.reposts != null ? Number(o.reposts) || 0 : undefined,
    views: o.views != null ? Number(o.views) || 0 : undefined,
    media: media?.length ? media : undefined,
    hidden: !!o.hidden,
    notes: o.notes != null ? String(o.notes) : undefined,
  }
}

function normalizeConfig(raw: unknown): ScexConfig {
  const d = defaultScexConfig()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>
  const keywords = Array.isArray(o.keywords)
    ? o.keywords.map((k) => String(k).trim()).filter(Boolean)
    : d.keywords
  const qLabels = {
    ...d.quadrantLabels,
    ...((o.quadrantLabels as object) || {}),
  } as ScexConfig['quadrantLabels']
  const sLabels = {
    ...d.sentimentLabels,
    ...((o.sentimentLabels as object) || {}),
  } as ScexConfig['sentimentLabels']
  const vol = (o.volumeAxis as ScexAxisConfig) || d.volumeAxis
  const qual = (o.qualityAxis as ScexAxisConfig) || d.qualityAxis
  return {
    brandName: String(o.brandName || d.brandName),
    brandHandle: String(o.brandHandle || d.brandHandle)
      .replace(/^@/, '')
      .trim(),
    keywords,
    timeWindowDays: Number(o.timeWindowDays) || d.timeWindowDays,
    kolMinPosts: Number(o.kolMinPosts) || d.kolMinPosts,
    userMinPosts: Number(o.userMinPosts) || d.userMinPosts,
    userMinFollowers: Number(o.userMinFollowers) || d.userMinFollowers,
    userMinQuality: Number(o.userMinQuality) || d.userMinQuality,
    volumeAxis: {
      min: Number(vol.min) || 0,
      max: Number(vol.max) || 20,
      label: String(vol.label || d.volumeAxis.label),
    },
    qualityAxis: {
      min: Number(qual.min) || 0,
      max: Number(qual.max) || 100,
      label: String(qual.label || d.qualityAxis.label),
    },
    sizeMetric: o.sizeMetric === 'reach7d' ? 'reach7d' : 'followers',
    volumeSplit: Number(o.volumeSplit) || d.volumeSplit,
    qualitySplit: Number(o.qualitySplit) || d.qualitySplit,
    quadrantLabels: qLabels,
    sentimentLabels: sLabels,
    matrixTitle: String(o.matrixTitle || d.matrixTitle),
    feedTitle: String(o.feedTitle || d.feedTitle),
    enabled: o.enabled !== false,
  }
}

/** Recompute quadrants for all actors from config splits. */
export function recomputeScexActors(dataset: ScexDataset): ScexDataset {
  const { volumeSplit, qualitySplit } = dataset.config
  const actors = dataset.actors.map((a) => ({
    ...a,
    quadrant: computeQuadrant(
      a.postsVolume,
      a.qualityScore,
      volumeSplit,
      qualitySplit,
    ),
  }))
  return { ...dataset, actors }
}

export function normalizeScexDataset(raw: unknown): ScexDataset | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const config = normalizeConfig(o.config)
  const actorsRaw = Array.isArray(o.actors) ? o.actors : []
  const postsRaw = Array.isArray(o.posts) ? o.posts : []
  const actors: ScexActor[] = []
  actorsRaw.forEach((item, i) => {
    const a = normalizeActor(item, i)
    if (a) actors.push(a)
  })
  const posts: ScexPost[] = []
  postsRaw.forEach((item, i) => {
    const p = normalizePost(item, i)
    if (p) posts.push(p)
  })
  posts.sort(
    (a, b) =>
      new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  )
  let ds: ScexDataset = {
    version: Number(o.version) || 1,
    kind: String(o.kind || 'scex-tracking'),
    asOf: String(o.asOf || new Date().toISOString()),
    updatedAt: o.updatedAt ? String(o.updatedAt) : undefined,
    note: o.note ? String(o.note) : undefined,
    config,
    actors,
    posts,
  }
  ds = recomputeScexActors(ds)
  return ds
}

export const SCEX_TRACKING_SEED: ScexDataset =
  normalizeScexDataset(seedJson) || {
    version: 1,
    kind: 'scex-tracking',
    asOf: new Date().toISOString(),
    config: defaultScexConfig(),
    actors: [],
    posts: [],
  }

export function createEmptyActor(kind: ScexActorKind = 'user'): ScexActor {
  const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return {
    id,
    handle: `user_${id.slice(-5)}`,
    displayName: 'New account',
    kind,
    followers: 0,
    postsVolume: 0,
    qualityScore: 50,
    sentiment: 'neutral',
  }
}

export function createEmptyPost(handle = ''): ScexPost {
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return {
    id,
    handle: handle.replace(/^@/, '').trim().toLowerCase(),
    url: '',
    text: '',
    postedAt: new Date().toISOString(),
    sentiment: 'neutral',
    hidden: false,
  }
}

/** Bubble position 0–1 inside matrix from actor metrics */
export function actorMatrixPos(
  actor: ScexActor,
  config: ScexConfig,
): { x: number; y: number } {
  const vmax = Math.max(config.volumeAxis.max, 1)
  const qmax = Math.max(config.qualityAxis.max, 1)
  const x = Math.min(1, Math.max(0, actor.postsVolume / vmax))
  const y = Math.min(1, Math.max(0, actor.qualityScore / qmax))
  return { x, y }
}

export function actorSizeValue(actor: ScexActor, config: ScexConfig): number {
  if (config.sizeMetric === 'reach7d') return actor.reach7d || actor.followers || 1
  return actor.followers || 1
}
