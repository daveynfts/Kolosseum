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
  /** Primary niche (color / layout cluster). Prefer first of `niches`. */
  niche: Niche
  /** Multi-label niches for diverse KOLs. Filter matches any. */
  niches?: Niche[]
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

/** @deprecated Prefer STATUS_EMOJI for UI; kept for rare legacy styling */
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

/** Status identity via emoji (replaces colored dots/text). */
export const STATUS_EMOJI: Record<StatusLabel, string> = {
  hot: '🔥',
  active: '⚡',
  stable: '🟢',
  quiet: '🌙',
  dormant: '💤',
}

/** e.g. "🔥 Hot" */
export function formatStatus(status: StatusLabel | string | undefined | null): string {
  if (!status) return '—'
  const key = String(status).toLowerCase() as StatusLabel
  const emoji = STATUS_EMOJI[key]
  const label = STATUS_LABELS[key]
  if (emoji && label) return `${emoji} ${label}`
  return String(status)
}

const NICHE_SET = new Set<string>([
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
])

/** All niches for a KOL (multi-label + fallback primary / typeRaw). */
export function getKolNiches(k: {
  niche?: Niche
  niches?: Niche[]
  typeRaw?: string
}): Niche[] {
  if (k.niches && k.niches.length > 0) {
    const uniq = Array.from(new Set(k.niches.filter(Boolean))) as Niche[]
    if (uniq.length) return uniq
  }
  if (k.niche && NICHE_SET.has(k.niche)) return [k.niche]
  // Parse sheet typeRaw: "Trading, News" / "Airdrop, Gamefi"
  if (k.typeRaw) {
    const parts = k.typeRaw.split(/[,/|]/).map((s) => s.trim())
    const mapped: Niche[] = []
    for (const p of parts) {
      const low = p.toLowerCase()
      if (low === 'all' || !low) continue
      if (low.includes('trade')) mapped.push('Trading')
      else if (low.includes('research')) mapped.push('Research')
      else if (low.includes('news')) mapped.push('News')
      else if (low.includes('airdrop')) mapped.push('Airdrop')
      else if (low.includes('otc')) mapped.push('OTC')
      else if (low.includes('defi')) mapped.push('DeFi')
      else if (low.includes('game')) mapped.push('GameFi')
      else if (low.includes('nft')) mapped.push('NFT')
      else if (low.includes('meme')) mapped.push('Meme')
    }
    const uniq = Array.from(new Set(mapped))
    if (uniq.length) return uniq
  }
  return ['Multi']
}

export function primaryNiche(k: {
  niche?: Niche
  niches?: Niche[]
  typeRaw?: string
}): Niche {
  return getKolNiches(k)[0] ?? 'Multi'
}

export function kolMatchesNiche(
  k: { niche?: Niche; niches?: Niche[]; typeRaw?: string },
  filter: Niche | 'All',
): boolean {
  if (filter === 'All') return true
  return getKolNiches(k).includes(filter)
}
