/**
 * Field provenance for Admin UI.
 * "ai" = generated/estimated by AI pipeline (not raw X ground truth).
 * "x" = from X profile (via fxtwitter) at last sync.
 * "human" = curated by operator / Google Sheet / admin edit.
 * "sample" = X search sample (may be capped).
 */

export type FieldSource = 'ai' | 'x' | 'human' | 'sample' | 'derived'

export interface FieldMeta {
  key: string
  label: string
  source: FieldSource
  note: string
  group: 'identity' | 'metrics' | 'scores' | 'activity7d' | 'flags'
}

export const FIELD_META: FieldMeta[] = [
  {
    key: 'displayName',
    label: 'Display name',
    source: 'human',
    note: 'Từ sheet / X name / admin',
    group: 'identity',
  },
  {
    key: 'handle',
    label: 'X handle',
    source: 'human',
    note: 'Curated list hoặc admin',
    group: 'identity',
  },
  {
    key: 'avatarUrl',
    label: 'Avatar R2 URL',
    source: 'human',
    note: 'Public URL R2 (radar/avatars/{handle}.jpg). Override khi cần đổi avatar; trống = path mặc định theo handle',
    group: 'identity',
  },
  {
    key: 'rank',
    label: 'Rank (5 bậc)',
    source: 'human',
    note: 'Challenger · Master · Diamond · Platinum · Gold — map + admin. Optional override; else derive from tier+score',
    group: 'identity',
  },
  {
    key: 'tier',
    label: 'Rank band (legacy)',
    source: 'human',
    note: '1=Chall/Master · 2=Dia/Plat · 3=Gold — synced when admin sets rank',
    group: 'identity',
  },
  {
    key: 'niche',
    label: 'Primary niche',
    source: 'human',
    note: 'Hạng mục chính (màu bubble) = niches[0]',
    group: 'identity',
  },
  {
    key: 'niches',
    label: 'Niches (multi)',
    source: 'human',
    note: 'Nhiều hạng mục content; filter map khớp bất kỳ niche nào',
    group: 'identity',
  },
  {
    key: 'typeRaw',
    label: 'Type (raw)',
    source: 'human',
    note: 'Cột Type trên sheet',
    group: 'identity',
  },
  {
    key: 'bio',
    label: 'Assessment / bio',
    source: 'ai',
    note: 'AI multi-paragraph: X self-bio + growth + pace + 7d window + feed sample + campaign fit. Không phải quote tay từ KOL.',
    group: 'identity',
  },
  {
    key: 'followers',
    label: 'Followers',
    source: 'x',
    note: 'X profile live (fxtwitter) lúc sync',
    group: 'metrics',
  },
  {
    key: 'xFollowing',
    label: 'Following',
    source: 'x',
    note: 'X profile live',
    group: 'metrics',
  },
  {
    key: 'tweetsTotal',
    label: 'Total tweets',
    source: 'x',
    note: 'X profile live',
    group: 'metrics',
  },
  {
    key: 'tweetsPerDay',
    label: 'Posts/day (life)',
    source: 'derived',
    note: 'tweets ÷ tuổi account',
    group: 'metrics',
  },
  {
    key: 'verified',
    label: 'Verified',
    source: 'x',
    note: 'X verification flag',
    group: 'metrics',
  },
  {
    key: 'smartFollowers',
    label: 'Quality proxy',
    source: 'ai',
    note: 'KHÔNG phải Smart Followers chính thức — AI proxy',
    group: 'metrics',
  },
  {
    key: 'posts24h',
    label: 'Posts 24h (legacy)',
    source: 'ai',
    note: 'Ước từ lifetime pace (legacy field)',
    group: 'metrics',
  },
  {
    key: 'likes24h',
    label: 'Likes 24h (legacy)',
    source: 'ai',
    note: 'Ước từ formula AI',
    group: 'metrics',
  },
  {
    key: 'statusLabel',
    label: 'Status',
    source: 'ai',
    note: 'AI heuristic (pace / 7d). Admin có thể override',
    group: 'scores',
  },
  {
    key: 'activityLevel',
    label: 'Activity level',
    source: 'ai',
    note: '0–100 từ heuristic AI',
    group: 'scores',
  },
  {
    key: 'baseScore',
    label: 'Base score',
    source: 'ai',
    note: 'log(followers) + tier + verified',
    group: 'scores',
  },
  {
    key: 'hotScore',
    label: 'Hot score',
    source: 'ai',
    note: 'Pace / blend 7d — AI formula',
    group: 'scores',
  },
  {
    key: 'score',
    label: 'Composite score',
    source: 'ai',
    note: '0.55·base + 0.45·hot (có thể recalculate)',
    group: 'scores',
  },
  {
    key: 'activity7dPosts',
    label: '7d posts',
    source: 'sample',
    note: 'sample = X search; nếu estimated thì AI',
    group: 'activity7d',
  },
  {
    key: 'activity7dLikes',
    label: '7d likes',
    source: 'sample',
    note: 'Theo activity7dSource',
    group: 'activity7d',
  },
  {
    key: 'activity7dViews',
    label: '7d views',
    source: 'sample',
    note: 'Theo activity7dSource',
    group: 'activity7d',
  },
  {
    key: 'activity7dScore',
    label: '7d score',
    source: 'ai',
    note: 'AI score từ posts/likes/views 7d',
    group: 'activity7d',
  },
  {
    key: 'activity7dSource',
    label: '7d source',
    source: 'human',
    note: 'sampled | estimated',
    group: 'activity7d',
  },
  {
    key: 'isTop30',
    label: 'Top 30 flag',
    source: 'derived',
    note: 'Top score lúc merge 7d',
    group: 'flags',
  },
  {
    key: 'hidden',
    label: 'Hidden',
    source: 'human',
    note: 'Admin ẩn khỏi map',
    group: 'flags',
  },
  {
    key: 'dataSource',
    label: 'Data source',
    source: 'derived',
    note: 'x-live / admin',
    group: 'flags',
  },
]

export const SOURCE_LABELS: Record<
  FieldSource,
  { label: string; color: string; short: string }
> = {
  ai: { label: 'AI generated', color: '#c4b5fd', short: 'AI' },
  x: { label: 'X live', color: '#7dd3fc', short: 'X' },
  human: { label: 'Human / admin', color: '#86efac', short: 'Human' },
  sample: { label: 'X sample', color: '#fcd34d', short: 'Sample' },
  derived: { label: 'Derived formula', color: '#94a3b8', short: 'Derived' },
}

export function metaFor(key: string): FieldMeta | undefined {
  return FIELD_META.find((f) => f.key === key)
}
