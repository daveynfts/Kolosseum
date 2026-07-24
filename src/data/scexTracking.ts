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

/**
 * Matrix scoring formula (admin-editable).
 * Volume (X) = log activity (gốc + reply weight), NOT followers.
 * Quality (Y) = map tier + sentiment + depth + mild engagement.
 */
export interface ScexScoringConfig {
  /** Weight of original posts in volume activity */
  volGocWeight: number
  /** Weight of replies in volume activity (usually < 1) */
  volReplyWeight: number
  /**
   * Soft views term in volume (log1p(views) × weight) — keeps 1-post accounts
   * from stacking on one X line without letting reach dominate multi-post KOLs.
   */
  volViewsSoftWeight: number
  /** Effective activity level that maps near 100 volume score */
  volLogCap: number
  /** Flat volume boost when account is verified on Radar map (0–15 recommended) */
  volMapBoost: number
  /** Quality weights — ideally sum ≈ 1 */
  wMapTier: number
  wSentiment: number
  wDepth: number
  wEngagement: number
  /** Map-verified rank → quality base 0–100 */
  mapTierScores: {
    challenger: number
    master: number
    diamond: number
    platinum: number
    gold: number
    none: number
  }
  /** Sentiment → quality base 0–100 */
  sentimentScores: {
    bullish: number
    neutral: number
    mixed: number
    bearish: number
    shill: number
    scam: number
  }
  /** When true, volumeScore is used for matrix X instead of raw postsVolume */
  useVolumeScore: boolean
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
  /** Split X (volume) for 4 quadrants — same unit as volumeScore (0–100) when useVolumeScore */
  volumeSplit: number
  /** Split Y (quality 0–100) */
  qualitySplit: number
  quadrantLabels: Record<ScexQuadrant, ScexQuadrantLabel>
  sentimentLabels: Record<ScexSentiment, ScexSentimentLabel>
  matrixTitle: string
  feedTitle: string
  enabled: boolean
  /** Matrix scoring formula (admin-managed) */
  scoring?: ScexScoringConfig
}

export interface ScexActor {
  id: string
  handle: string
  displayName: string
  kind: ScexActorKind
  /** Radar tier or free text / map rank label */
  tier?: string
  followers: number
  reach7d?: number
  /** Raw mention activity (gốc + reply) — display / export */
  postsVolume: number
  /** Matrix X score 0–100 (log activity) */
  volumeScore?: number
  /** Matrix Y score 0–100 (quality) */
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
  /** Human-readable score breakdown for admin/debug */
  scoreLog?: string
  /** Original posts count if known */
  gocPosts?: number
  /** Reply count if known */
  replyPosts?: number
  /** Map rank when verified on Radar map */
  mapRank?: string
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
    title: 'Ưu tiên hợp tác',
    subtitle: 'Hay mention · chất lượng cao — nên ưu tiên tiếp cận',
  },
  nurture: {
    title: 'Có tiềm năng',
    subtitle: 'Chất lượng cao · ít mention — nên khuyến khích tương tác',
  },
  noise: {
    title: 'Cần rà soát',
    subtitle: 'Hay mention · chất lượng thấp — lọc và đánh giá lại',
  },
  ignore: {
    title: 'Ít ưu tiên',
    subtitle: 'Ít mention · chất lượng thấp — không cần ưu tiên',
  },
}

export function defaultScexScoring(): ScexScoringConfig {
  return {
    volGocWeight: 1,
    volReplyWeight: 0.35,
    volViewsSoftWeight: 0.12,
    volLogCap: 14,
    volMapBoost: 6,
    wMapTier: 0.38,
    wSentiment: 0.22,
    wDepth: 0.25,
    wEngagement: 0.15,
    mapTierScores: {
      challenger: 95,
      master: 88,
      diamond: 78,
      platinum: 68,
      gold: 55,
      none: 40,
    },
    sentimentScores: {
      bullish: 74,
      neutral: 54,
      mixed: 58,
      bearish: 46,
      shill: 32,
      scam: 18,
    },
    useVolumeScore: true,
  }
}

/** Plain-language axis labels (hide scoring jargon for partner UI). */
export function viVolumeAxisLabel(raw?: string): string {
  const s = (raw || '').trim()
  if (!s || /log|activity|điểm tần|volume score|raw/i.test(s)) {
    return 'Tần suất mention'
  }
  return s
}

export function viQualityAxisLabel(raw?: string): string {
  const s = (raw || '').trim()
  if (!s || /tier|signal|điểm chất|quality score|scoring/i.test(s)) {
    return 'Chất lượng'
  }
  return s
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
    volumeAxis: { min: 0, max: 100, label: 'Tần suất mention' },
    qualityAxis: { min: 0, max: 100, label: 'Chất lượng' },
    sizeMetric: 'followers',
    /** Mid of 0–100 volume score */
    volumeSplit: 42,
    qualitySplit: 55,
    quadrantLabels: { ...DEFAULT_QUAD },
    sentimentLabels: { ...DEFAULT_SENTIMENT },
    matrixTitle: 'Ma trận mention SCEX',
    feedTitle: 'Bảng tin mention · SCEX',
    enabled: true,
    scoring: defaultScexScoring(),
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

function clamp01(n: number): number {
  return Math.min(100, Math.max(0, n))
}

function logScale(value: number, cap: number): number {
  const v = Math.max(0, value)
  const c = Math.max(1, cap)
  return (100 * Math.log1p(v)) / Math.log1p(c)
}

/** Parse goc/reply from tags `goc:3,reply:1` or notes `Gốc 3 · Reply 1` */
export function parseGocReply(actor: ScexActor): { goc: number; reply: number } {
  if (actor.gocPosts != null || actor.replyPosts != null) {
    return {
      goc: Math.max(0, Number(actor.gocPosts) || 0),
      reply: Math.max(0, Number(actor.replyPosts) || 0),
    }
  }
  const tags = actor.tags || ''
  const notes = actor.notes || ''
  const gocTag = tags.match(/goc:(\d+)/i)
  const replyTag = tags.match(/reply:(\d+)/i)
  if (gocTag || replyTag) {
    return {
      goc: gocTag ? Number(gocTag[1]) : 0,
      reply: replyTag ? Number(replyTag[1]) : 0,
    }
  }
  const gocNote = notes.match(/Gốc\s+(\d+)/i)
  const replyNote = notes.match(/Reply\s+(\d+)/i)
  if (gocNote || replyNote) {
    return {
      goc: gocNote ? Number(gocNote[1]) : 0,
      reply: replyNote ? Number(replyNote[1]) : 0,
    }
  }
  // Fallback: treat postsVolume as originals
  const v = Math.max(0, Number(actor.postsVolume) || 0)
  return { goc: v, reply: 0 }
}

export function isMixedSentiment(actor: ScexActor): boolean {
  const t = `${actor.tags || ''} ${actor.notes || ''}`.toLowerCase()
  return (
    t.includes('mixed') ||
    t.includes('hỗn hợp') ||
    t.includes('hon hop') ||
    t.includes('hỗn')
  )
}

export type MapRankInput = {
  handle: string
  rank?: string
  tier?: number
  score?: number
}

function resolveMapRankKey(
  mapKol: MapRankInput | undefined,
): keyof ScexScoringConfig['mapTierScores'] {
  if (!mapKol) return 'none'
  const r = String(mapKol.rank || '')
    .toLowerCase()
    .trim()
  if (
    r === 'challenger' ||
    r === 'master' ||
    r === 'diamond' ||
    r === 'platinum' ||
    r === 'gold'
  )
    return r
  // Derive from tier band + score (same as map)
  const tier = mapKol.tier ?? 3
  const score = mapKol.score ?? 50
  if (tier <= 1) return score >= 96 ? 'challenger' : 'master'
  if (tier === 2) return score >= 92 ? 'diamond' : 'platinum'
  return 'gold'
}

/**
 * Recompute volumeScore + qualityScore + quadrant for one actor.
 * Map KOLs (verified on Radar) get higher map-tier quality.
 */
export function scoreScexActor(
  actor: ScexActor,
  config: ScexConfig,
  mapKol?: MapRankInput,
): ScexActor {
  const sc = { ...defaultScexScoring(), ...(config.scoring || {}) }
  const { goc, reply } = parseGocReply(actor)
  const views = Number(actor.reach7d) || 0
  const followers = Math.max(0, Number(actor.followers) || 0)

  // —— Quality parts (map rank first — used for volume boost too) ——
  const mapKey = resolveMapRankKey(mapKol)
  const mapPart = sc.mapTierScores[mapKey] ?? sc.mapTierScores.none

  // —— Volume (X): log activity + soft views + map boost (not followers-led) ——
  const viewsSoft =
    Math.log1p(views) * (sc.volViewsSoftWeight ?? 0.12)
  const activity =
    goc * (sc.volGocWeight ?? 1) +
    reply * (sc.volReplyWeight ?? 0.35) +
    viewsSoft
  let volumeScore = logScale(activity, sc.volLogCap ?? 14)
  if (mapKey !== 'none') {
    volumeScore += sc.volMapBoost ?? 6
  }
  volumeScore = clamp01(volumeScore)

  const mixed = isMixedSentiment(actor)
  const sentKey = mixed
    ? 'mixed'
    : (actor.sentiment as keyof typeof sc.sentimentScores)
  const sentPart =
    sc.sentimentScores[sentKey] ?? sc.sentimentScores.neutral

  // Depth: reward multi-original commitment; mild reply bonus; penalty reply-spam
  let depth =
    38 +
    Math.min(42, goc * 14) +
    Math.min(12, Math.log1p(reply) * 8)
  if (reply > goc * 4 && goc <= 2) depth -= 12
  if (goc >= 5) depth += 6
  depth = clamp01(depth)

  // Engagement: mild views efficiency — deliberately low influence
  const vr = views / Math.max(followers, 1)
  const eng = clamp01(28 + Math.log10(vr * 500 + 1) * 28)

  const wM = sc.wMapTier ?? 0.38
  const wS = sc.wSentiment ?? 0.22
  const wD = sc.wDepth ?? 0.25
  const wE = sc.wEngagement ?? 0.15
  const wSum = Math.max(0.01, wM + wS + wD + wE)
  const qualityScore = clamp01(
    (mapPart * wM + sentPart * wS + depth * wD + eng * wE) / wSum,
  )

  const useVol = sc.useVolumeScore !== false
  const volForQuad = useVol ? volumeScore : actor.postsVolume
  const volumeSplit = config.volumeSplit
  const qualitySplit = config.qualitySplit
  const quadrant = computeQuadrant(
    volForQuad,
    qualityScore,
    volumeSplit,
    qualitySplit,
  )

  const mapLabel = mapKey === 'none' ? 'off-map' : mapKey
  const scoreLog = [
    `V=${Math.round(volumeScore)}(act=${activity.toFixed(2)} goc=${goc} reply=${reply} viewsSoft=${viewsSoft.toFixed(2)}${mapKey !== 'none' ? ` +mapBoost${sc.volMapBoost ?? 6}` : ''})`,
    `Q=${Math.round(qualityScore)}(map=${mapLabel}:${Math.round(mapPart)}×${wM} sent=${Math.round(sentPart)}×${wS} depth=${Math.round(depth)}×${wD} eng=${Math.round(eng)}×${wE})`,
    `quad=${quadrant} splitV=${volumeSplit}/Q=${qualitySplit}`,
  ].join(' · ')

  const rawVol = goc + reply || actor.postsVolume

  return {
    ...actor,
    gocPosts: goc,
    replyPosts: reply,
    postsVolume: rawVol,
    volumeScore: Math.round(volumeScore * 10) / 10,
    qualityScore: Math.round(qualityScore * 10) / 10,
    quadrant,
    mapRank: mapKey === 'none' ? undefined : mapKey,
    tier: mapKey === 'none' ? actor.tier : mapKey,
    scoreLog,
  }
}

/**
 * Recompute all actor scores. Pass mapKols for verified-tier boost.
 */
export function recomputeScexScores(
  dataset: ScexDataset,
  mapKols?: MapRankInput[],
): ScexDataset {
  const map = new Map<string, MapRankInput>()
  for (const k of mapKols || []) {
    const h = String(k.handle || '')
      .replace(/^@/, '')
      .toLowerCase()
    if (h) map.set(h, k)
  }
  const actors = dataset.actors.map((a) =>
    scoreScexActor(a, dataset.config, map.get(a.handle.toLowerCase())),
  )
  // Sort: stars first, then volume score, then quality
  actors.sort((a, b) => {
    const qa = a.quadrant || 'ignore'
    const qb = b.quadrant || 'ignore'
    const order: Record<string, number> = {
      stars: 0,
      nurture: 1,
      noise: 2,
      ignore: 3,
    }
    if ((order[qa] ?? 9) !== (order[qb] ?? 9))
      return (order[qa] ?? 9) - (order[qb] ?? 9)
    const va = a.volumeScore ?? a.postsVolume
    const vb = b.volumeScore ?? b.postsVolume
    if (vb !== va) return vb - va
    return b.qualityScore - a.qualityScore
  })
  return { ...dataset, actors }
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
    volumeScore:
      o.volumeScore != null
        ? Math.min(100, Math.max(0, Number(o.volumeScore) || 0))
        : undefined,
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
    scoreLog: o.scoreLog != null ? String(o.scoreLog) : undefined,
    gocPosts: o.gocPosts != null ? Number(o.gocPosts) || 0 : undefined,
    replyPosts: o.replyPosts != null ? Number(o.replyPosts) || 0 : undefined,
    mapRank: o.mapRank != null ? String(o.mapRank) : undefined,
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
  const scoringRaw =
    o.scoring && typeof o.scoring === 'object'
      ? (o.scoring as Partial<ScexScoringConfig>)
      : {}
  const baseScoring = defaultScexScoring()
  const scoring: ScexScoringConfig = {
    ...baseScoring,
    ...scoringRaw,
    mapTierScores: {
      ...baseScoring.mapTierScores,
      ...((scoringRaw.mapTierScores as object) || {}),
    },
    sentimentScores: {
      ...baseScoring.sentimentScores,
      ...((scoringRaw.sentimentScores as object) || {}),
    },
  }
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
      max: Number(vol.max) || 100,
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
    scoring,
  }
}

/** Recompute quadrants only (uses volumeScore when available). */
export function recomputeScexActors(dataset: ScexDataset): ScexDataset {
  const { volumeSplit, qualitySplit, scoring } = dataset.config
  const useVol = scoring?.useVolumeScore !== false
  const actors = dataset.actors.map((a) => {
    const vol = useVol && a.volumeScore != null ? a.volumeScore : a.postsVolume
    return {
      ...a,
      quadrant: computeQuadrant(vol, a.qualityScore, volumeSplit, qualitySplit),
    }
  })
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
  const useVol = config.scoring?.useVolumeScore !== false
  const vol =
    useVol && actor.volumeScore != null ? actor.volumeScore : actor.postsVolume
  const vmax = Math.max(config.volumeAxis.max, 1)
  const qmax = Math.max(config.qualityAxis.max, 1)
  const x = Math.min(1, Math.max(0, vol / vmax))
  const y = Math.min(1, Math.max(0, actor.qualityScore / qmax))
  return { x, y }
}

/** Value shown on matrix X axis for an actor */
export function actorVolumeMetric(
  actor: ScexActor,
  config: ScexConfig,
): number {
  const useVol = config.scoring?.useVolumeScore !== false
  if (useVol && actor.volumeScore != null) return actor.volumeScore
  return actor.postsVolume
}

export function actorSizeValue(actor: ScexActor, config: ScexConfig): number {
  if (config.sizeMetric === 'reach7d') return actor.reach7d || actor.followers || 1
  return actor.followers || 1
}
