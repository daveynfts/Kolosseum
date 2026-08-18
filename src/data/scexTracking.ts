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

/** Admin pipeline: SCEX → possible Radar map promotion */
export type ScexRadarPipeline =
  | 'none'
  | 'candidate'
  | 'review'
  | 'promoted'
  | 'rejected'

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
 * Quality (Y / “Uy tín”) = map tier (or audience trust if off-map)
 *   + sentiment + depth + mild engagement.
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
  /**
   * R2 public avatar URL after warm (`radar/avatars/{handle}.jpg`).
   * UI still falls back to XProfileAvatar casing variants if unset.
   */
  avatarUrl?: string
  /** ISO when avatar last warmed to R2 via PUT /api/avatar */
  avatarWarmedAt?: string
  /**
   * Admin: shortlist for possible transfer onto main Radar map.
   * Default none; new harvest batches set `candidate`.
   */
  radarPipeline?: ScexRadarPipeline
  /** Admin note for Radar promotion decision */
  radarNote?: string
  /** When this handle was first added to SCEX tracking (ISO date or datetime) */
  sourcedAt?: string
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
    qualityAxis: { min: 0, max: 100, label: 'Uy tín' },
    sizeMetric: 'followers',
    /** Mid of 0–100 volume score */
    volumeSplit: 42,
    qualitySplit: 50,
    quadrantLabels: { ...DEFAULT_QUAD },
    sentimentLabels: { ...DEFAULT_SENTIMENT },
    matrixTitle: 'Ma trận SCEX',
    feedTitle: 'SCEX Live Feed',
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

/** Partner UI title — ignores stale R2 jargon (TRỌNG ĐIỂM, Nuôi dưỡng, …). */
export function partnerQuadrantTitle(
  key?: ScexQuadrant | string | null,
): string {
  if (!key) return ''
  if (key in DEFAULT_QUAD) {
    return DEFAULT_QUAD[key as ScexQuadrant].title
  }
  const raw = String(key).trim()
  if (/trọng điểm|stars/i.test(raw)) return DEFAULT_QUAD.stars.title
  if (/nuôi dưỡng|tiềm năng|nurture/i.test(raw)) return DEFAULT_QUAD.nurture.title
  if (/rà soát|noise/i.test(raw)) return DEFAULT_QUAD.noise.title
  if (/tín hiệu yếu|ít ưu tiên|ignore/i.test(raw)) return DEFAULT_QUAD.ignore.title
  return raw
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

const MAP_RANK_KEYS = [
  'challenger',
  'master',
  'diamond',
  'platinum',
  'gold',
] as const

type MapRankKey = (typeof MAP_RANK_KEYS)[number] | 'none'

function isMapRankKey(s: string): s is Exclude<MapRankKey, 'none'> {
  return (MAP_RANK_KEYS as readonly string[]).includes(s)
}

/**
 * Audience trust proxy for off-map accounts (0–100).
 * Used as the "map/trust" quality leg when not verified on Davey's Radar.
 * Calibrated so micro accounts stay in the lower band while large KOLs
 * clear the mid split (50) — without matching map diamond (78):
 *   ~500 fl → ~42, ~5k → ~50, ~25k → ~58, ~80k → ~63, ~300k → ~69
 */
export function audienceTrustScore(followers: number): number {
  const f = Math.max(0, Number(followers) || 0)
  // log10(f+120): 500→2.79, 5k→3.72, 25k→4.40, 80k→4.90, 300k→5.48
  return clamp01(14 + Math.log10(f + 120) * 10)
}

/**
 * Resolve Radar map rank for scoring.
 * Priority: live map join → stored actor.mapRank.
 * Does NOT use actor.tier — export scripts write follower-band labels
 * (e.g. Challenger @3k) that are NOT Radar ranks.
 */
function resolveMapRankKey(
  mapKol: MapRankInput | undefined,
  actor?: ScexActor,
): MapRankKey {
  if (mapKol) {
    const r = String(mapKol.rank || '')
      .toLowerCase()
      .trim()
    if (isMapRankKey(r)) return r
    // Derive from tier band + score (same as map)
    const tier = mapKol.tier ?? 3
    const score = mapKol.score ?? 50
    if (tier <= 1) return score >= 96 ? 'challenger' : 'master'
    if (tier === 2) return score >= 92 ? 'diamond' : 'platinum'
    return 'gold'
  }
  const stored = String(actor?.mapRank || '')
    .toLowerCase()
    .trim()
  if (isMapRankKey(stored)) return stored
  return 'none'
}

/**
 * Recompute volumeScore + qualityScore + quadrant for one actor.
 * Map KOLs (verified on Radar) get higher map-tier quality.
 * Off-map accounts use audience size as trust proxy (not flat 40).
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

  // —— Trust / map leg (Y) — used for volume boost when on-map ——
  const mapKey = resolveMapRankKey(mapKol, actor)
  const onMap = mapKey !== 'none'
  const mapPart = onMap
    ? (sc.mapTierScores[mapKey] ?? sc.mapTierScores.none)
    : audienceTrustScore(followers)

  // —— Volume (X): log activity + soft views + map boost (not followers-led) ——
  const viewsSoft =
    Math.log1p(views) * (sc.volViewsSoftWeight ?? 0.12)
  const activity =
    goc * (sc.volGocWeight ?? 1) +
    reply * (sc.volReplyWeight ?? 0.35) +
    viewsSoft
  let volumeScore = logScale(activity, sc.volLogCap ?? 14)
  if (onMap) {
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

  const mapLabel = onMap ? mapKey : `audience`
  const scoreLog = [
    `V=${Math.round(volumeScore)}(act=${activity.toFixed(2)} goc=${goc} reply=${reply} viewsSoft=${viewsSoft.toFixed(2)}${onMap ? ` +mapBoost${sc.volMapBoost ?? 6}` : ''})`,
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
    mapRank: onMap ? mapKey : undefined,
    tier: onMap ? mapKey : actor.tier,
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

/** Strip VN diacritics for keyword matching. */
function foldVi(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Infer SCEX post sentiment from body text.
 * Fixes common export mistakes (e.g. partnership news labeled “Bearish”).
 */
/**
 * Event-task spam: reply farms that lead with the same mention cluster
 * `@XNXX_EN @scexofficial @Convictionvn …`
 */
export function isScexEventTaskSpam(text: string): boolean {
  const t = String(text || '').trim()
  if (!t) return false
  return /^@xnxx_en\s+@scexofficial\s+@convictionvn\b/i.test(t)
}

export function inferScexSentiment(text: string): ScexSentiment {
  const raw = String(text || '').trim()
  if (raw.length < 8) return 'neutral'
  const t = foldVi(raw)

  // Hard scam / brand attack
  if (
    /\bscam\b|lua dao|lua đảo|rug\s*pull|\brug\b|sap san|sập sàn|phot scex|phốt scex/.test(
      t,
    ) || /lừa đảo|sập sàn/.test(raw.toLowerCase())
  ) {
    return 'scam'
  }

  // Hard negative product / brand dismissal
  // Note: do NOT match bare "rac" — folds "rắc rối" (hassle) → false bearish
  const hardNeg =
    /khong ra gi|không ra gì|qua rac|toan rac|rac qua|đểu|deu qua|tranh xa|đừng dùng|dung dung|canh bao scam|otp.*khong gui|otp.*không gửi|cong nghe v sao|công nghệ v sao|buc minh|bực mình/.test(
      t,
    ) || /không ra gì|tránh xa|đừng dùng|bực mình/.test(raw.toLowerCase())

  // Strong positive: partnerships, sponsorship, awards, celebration
  const strongBull =
    /ky ket|ký kết|hop tac|hợp tác|thoa thuan|thỏa thuận|mou\b|bat tay|bắt tay|chuc mung|chúc mừng|nha tai tro|nhà tài trợ|tai tro vang|tài trợ vàng|giai thuong|giải thưởng|thuc day|thúc đẩy|chien luoc|chiến lược|partnership|sponsor|bullish|tich cuc|tích cực|he sinh thai|hệ sinh thái|dang cap|đẳng cấp|chinh thuc|chính thức góp|tro thanh nha|trở thành nhà/.test(
      t,
    )

  // Mild product critique / observation (not brand hate)
  const mildCrit =
    /lag|don so|đơn sơ|non tre|non trẻ|ton dung luong|tốn dung lượng|chua ho tro|chưa hỗ trợ|con nhieu|còn nhiều|cai thien|cải thiện|phai sinh|phái sinh|khong chiu noi|không chịu nổi|fomo|thac mac|thắc mắc|lieu co phai|liệu có phải|phản ánh|phan anh|thuế|thue 0|mong .*muot|mượt chút|chua tot|chưa tốt|giao dien|giao diện|thanh khoan|thanh khoản/.test(
      t,
    )

  // Promo / trial experience (lean positive unless hard-neg)
  const softBull =
    /tham gia|đăng ký|dang ky|thu nghiem|thử nghiệm|demo|giao dich tren|giao dịch trên|lai duoc|lãi được|top \d|bxh|đấu trường|dau truong|giai thuong|ref_code|ma gioi thieu|mã giới thiệu/.test(
      t,
    )

  if (hardNeg && !strongBull) return 'bearish'
  if (strongBull && !hardNeg) return 'bullish'
  if (strongBull && hardNeg) return 'neutral'
  if (mildCrit && !strongBull) return 'neutral'
  if (softBull && !hardNeg) return 'bullish'
  return 'neutral'
}

/** Majority sentiment across an actor’s posts (hidden excluded). */
export function dominantScexSentiment(
  posts: Pick<ScexPost, 'sentiment' | 'hidden'>[],
): ScexSentiment {
  const counts: Record<ScexSentiment, number> = {
    bullish: 0,
    bearish: 0,
    neutral: 0,
    shill: 0,
    scam: 0,
  }
  for (const p of posts) {
    if (p.hidden) continue
    const s = normalizeSentiment(p.sentiment)
    counts[s]++
  }
  const total =
    counts.bullish +
    counts.bearish +
    counts.neutral +
    counts.shill +
    counts.scam
  if (total === 0) return 'neutral'
  if (counts.scam > 0 && counts.scam >= counts.bullish) return 'scam'
  // Mixed bullish + bearish without clear majority → neutral (UI “Hỗn hợp” via tags)
  if (counts.bullish > 0 && counts.bearish > 0) {
    if (counts.bullish >= counts.bearish * 2) return 'bullish'
    if (counts.bearish >= counts.bullish * 2) return 'bearish'
    return 'neutral'
  }
  let best: ScexSentiment = 'neutral'
  let bestN = -1
  for (const k of [
    'bullish',
    'neutral',
    'bearish',
    'shill',
    'scam',
  ] as ScexSentiment[]) {
    if (counts[k] > bestN) {
      bestN = counts[k]
      best = k
    }
  }
  return best
}

/**
 * Re-tag every post with real body text from content, then roll up actor tone.
 * Skips thin export placeholders so manual admin tags are kept when no text.
 */
export function recomputeScexSentiments(dataset: ScexDataset): ScexDataset {
  const posts = dataset.posts.map((p) => {
    const text = String(p.text || '').trim()
    const thin =
      text.length < 20 ||
      /mention SCEX \(export|export gốc|export batch|list58|curated SCEX mention/i.test(
        text,
      )
    if (thin) return p
    const next = inferScexSentiment(text)
    if (next === p.sentiment) return p
    return {
      ...p,
      sentiment: next,
      notes: [p.notes, `sentiment:auto→${next}`]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 400),
    }
  })

  const byHandle = new Map<string, ScexPost[]>()
  for (const p of posts) {
    const h = p.handle.toLowerCase()
    if (!byHandle.has(h)) byHandle.set(h, [])
    byHandle.get(h)!.push(p)
  }

  const actors = dataset.actors.map((a) => {
    const list = byHandle.get(a.handle.toLowerCase()) || []
    if (!list.length) return a
    const sentiment = dominantScexSentiment(list)
    const counts = { bullish: 0, bearish: 0 }
    for (const p of list) {
      if (p.hidden) continue
      if (p.sentiment === 'bullish') counts.bullish++
      if (p.sentiment === 'bearish' || p.sentiment === 'scam') counts.bearish++
    }
    let tags = a.tags || ''
    const mixed = counts.bullish > 0 && counts.bearish > 0
    if (mixed && !/mixed|hỗn|hon hop/i.test(tags)) {
      tags = tags ? `${tags},mixed` : 'mixed'
    }
    if (!mixed && /(?:^|,)mixed(?:,|$)/i.test(tags)) {
      tags = tags
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x && !/^mixed$/i.test(x))
        .join(',')
    }
    return {
      ...a,
      sentiment,
      tags: tags || undefined,
      notes: a.notes,
    }
  })

  return { ...dataset, posts, actors }
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
    avatarUrl:
      o.avatarUrl != null && String(o.avatarUrl).trim()
        ? String(o.avatarUrl).trim()
        : undefined,
    avatarWarmedAt:
      o.avatarWarmedAt != null ? String(o.avatarWarmedAt) : undefined,
    radarPipeline: normalizeRadarPipeline(o.radarPipeline),
    radarNote: o.radarNote != null ? String(o.radarNote) : undefined,
    sourcedAt: o.sourcedAt != null ? String(o.sourcedAt) : undefined,
  }
}

function normalizeRadarPipeline(raw: unknown): ScexRadarPipeline | undefined {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (
    s === 'none' ||
    s === 'candidate' ||
    s === 'review' ||
    s === 'promoted' ||
    s === 'rejected'
  )
    return s
  return undefined
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
  const useVol = scoring.useVolumeScore !== false
  let volumeSplit = Number(o.volumeSplit) || d.volumeSplit
  let volumeAxisMax = Number(vol.max) || 100
  // Export scripts historically wrote post-count splits (e.g. 3 / 20).
  // volumeScore is 0–100 — clamp stale config onto that scale.
  if (useVol && volumeSplit > 0 && volumeSplit <= 20) volumeSplit = d.volumeSplit
  if (useVol && volumeAxisMax > 0 && volumeAxisMax <= 20) volumeAxisMax = 100
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
      max: volumeAxisMax,
      label: String(vol.label || d.volumeAxis.label),
    },
    qualityAxis: {
      min: Number(qual.min) || 0,
      max: Number(qual.max) || 100,
      label: String(qual.label || d.qualityAxis.label),
    },
    sizeMetric: o.sizeMetric === 'reach7d' ? 'reach7d' : 'followers',
    volumeSplit,
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
  ds = recomputeScexScores(ds)
  return ds
}

/**
 * Public GET view: drop hidden posts and admin-only actor/post fields.
 * Actor `notes` stay — public KOL detail renders them.
 */
export function publicScexDataset<T extends {
  actors?: unknown[]
  posts?: unknown[]
}>(data: T): T {
  const posts = Array.isArray(data.posts) ? data.posts : []
  const actors = Array.isArray(data.actors) ? data.actors : []
  return {
    ...data,
    posts: posts
      .filter((p) => {
        if (!p || typeof p !== 'object') return false
        return (p as { hidden?: unknown }).hidden !== true
      })
      .map((p) => {
        const row = { ...(p as Record<string, unknown>) }
        delete row.notes
        delete row.hidden
        return row
      }),
    actors: actors.map((a) => {
      if (!a || typeof a !== 'object') return a
      const row = { ...(a as Record<string, unknown>) }
      delete row.scoreLog
      delete row.radarNote
      delete row.trackingCode
      return row
    }),
  }
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
