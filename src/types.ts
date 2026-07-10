export type Niche =
  | 'Trading'
  | 'Research'
  | 'News'
  | 'Airdrop'
  | 'OTC'
  | 'DeFi'
  | 'GameFi'
  | 'NFT'
  | 'Meme'
  | 'Multi'

export type StatusLabel = 'hot' | 'active' | 'stable' | 'quiet' | 'dormant'

export interface Kol {
  id: string
  handle: string
  displayName: string
  niche: Niche
  tier?: number
  typeRaw?: string
  /** Quality-weighted proxy (not official X Smart Followers) */
  smartFollowers: number
  /** Live X followers */
  followers: number
  /** Estimated daily pace fields (legacy) */
  posts24h: number
  likes24h: number
  replies24h: number
  reposts24h: number
  baseScore: number
  hotScore: number
  score: number
  /** % delta vs followers recorded on Google Sheet */
  deltaPct: number
  /** Objective assessment from live profile */
  bio: string
  city?: string
  statusLabel?: StatusLabel
  activityLevel?: number
  verified?: boolean
  tweetsTotal?: number
  tweetsPerDay?: number
  xFollowing?: number
  dataSource?: string
  /** Top-30 flag after 7d merge */
  isTop30?: boolean
  /** Real/estimated activity in last 7 days */
  activity7dPosts?: number
  activity7dLikes?: number
  activity7dViews?: number
  activity7dReplies?: number
  activity7dReposts?: number
  activity7dScore?: number
  /** sampled = X search sample; estimated = lifetime pace × 7 */
  activity7dSource?: 'sampled' | 'estimated'
  /** Admin: hide from public map */
  hidden?: boolean
}

export const NICHE_COLORS: Record<Niche, string> = {
  Trading: '#a78bfa',
  Research: '#22d3ee',
  News: '#fbbf24',
  Airdrop: '#34d399',
  OTC: '#fb923c',
  DeFi: '#38bdf8',
  GameFi: '#60a5fa',
  NFT: '#f472b6',
  Meme: '#e879f9',
  Multi: '#94a3b8',
}

export const STATUS_COLORS: Record<StatusLabel, string> = {
  hot: '#f472b6',
  active: '#34d399',
  stable: '#60a5fa',
  quiet: '#fbbf24',
  dormant: '#94a3b8',
}

export const STATUS_LABELS: Record<StatusLabel, string> = {
  hot: 'Hot',
  active: 'Active',
  stable: 'Stable',
  quiet: 'Quiet',
  dormant: 'Dormant',
}
