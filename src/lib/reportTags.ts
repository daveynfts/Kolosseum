/**
 * Smart tags for KOL reports — aligned with map niches + report semantics.
 */

/** Canonical tags (display form). */
export const REPORT_TAG_PRESETS = [
  // Map niches
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
  // Report / content
  'Builder',
  'Community',
  'Arc',
  'On-chain',
  'Alpha',
  'Education',
  'Macro',
  'Featured',
] as const

export type ReportTagPreset = (typeof REPORT_TAG_PRESETS)[number]

/** Legacy / noise tags from import — demoted, not shown as primary chips */
const SYSTEM_NOISE = new Set([
  'surfai',
  'docx-import',
  'docx_import',
  'map-sync',
  'map_sync',
  'import',
])

const ALIASES: Record<string, string> = {
  trading: 'Trading',
  trade: 'Trading',
  trader: 'Trading',
  research: 'Research',
  researcher: 'Research',
  news: 'News',
  airdrop: 'Airdrop',
  airdrops: 'Airdrop',
  otc: 'OTC',
  defi: 'DeFi',
  gamefi: 'GameFi',
  game: 'GameFi',
  nft: 'NFT',
  nfts: 'NFT',
  meme: 'Meme',
  memes: 'Meme',
  multi: 'Multi',
  builder: 'Builder',
  builders: 'Builder',
  community: 'Community',
  arc: 'Arc',
  'on-chain': 'On-chain',
  onchain: 'On-chain',
  'on chain': 'On-chain',
  alpha: 'Alpha',
  education: 'Education',
  educational: 'Education',
  macro: 'Macro',
  featured: 'Featured',
  surfai: 'SurfAI',
  'surf ai': 'SurfAI',
  surf: 'SurfAI',
}

export function isNoiseTag(tag: string): boolean {
  return SYSTEM_NOISE.has(String(tag || '').trim().toLowerCase())
}

/** Normalize free-form tag to canonical display form */
export function normalizeTag(raw: string): string {
  const t = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!t) return ''
  const key = t.toLowerCase()
  if (ALIASES[key]) return ALIASES[key]
  // Title-Case multi-word
  return t
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => {
      if (/^[A-Z0-9]{2,}$/.test(w)) return w // OTC, NFT keep
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

export function normalizeTags(tags: string[] | undefined | null): string[] {
  if (!tags?.length) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    const n = normalizeTag(raw)
    if (!n || isNoiseTag(n)) continue
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(n)
  }
  return out
}

/** Tags for UI (exclude noise) */
export function displayTags(tags: string[] | undefined | null): string[] {
  return normalizeTags(tags)
}

/** Parse comma/space input into tags */
export function parseTagInput(raw: string): string[] {
  return normalizeTags(
    String(raw || '')
      .split(/[,;|]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export function toggleTag(tags: string[], tag: string): string[] {
  const n = normalizeTag(tag)
  if (!n) return normalizeTags(tags)
  const cur = normalizeTags(tags)
  const k = n.toLowerCase()
  if (cur.some((t) => t.toLowerCase() === k)) {
    return cur.filter((t) => t.toLowerCase() !== k)
  }
  return [...cur, n]
}

/** Lightweight keyword → tag from report body */
const TEXT_RULES: Array<{ re: RegExp; tag: string }> = [
  { re: /\bair\s*drop|farm(?:ing)?\b/i, tag: 'Airdrop' },
  { re: /\bdefi|perp|dex|amm|lend(?:ing)?\b/i, tag: 'DeFi' },
  { re: /\bnft|opensea|blur\b/i, tag: 'NFT' },
  { re: /\bgamefi|play[\s-]?to[\s-]?earn|p2e\b/i, tag: 'GameFi' },
  { re: /\bmeme\s*coin|shitcoin\b/i, tag: 'Meme' },
  { re: /\botc|over[\s-]?the[\s-]?counter\b/i, tag: 'OTC' },
  { re: /\bresearch|dd\b|due diligence|thesis\b/i, tag: 'Research' },
  { re: /\btrad(?:e|ing|er)\b|chart|ta\b|technical analysis\b/i, tag: 'Trading' },
  { re: /\bnews|headline|breaking\b/i, tag: 'News' },
  { re: /\bbuilder|build(?:ing)?|dev(?:eloper)?\b/i, tag: 'Builder' },
  { re: /\bcommunity|cộng đồng|discord|telegram\b/i, tag: 'Community' },
  { re: /\barc\b|circle\s*l1\b/i, tag: 'Arc' },
  { re: /\bon[\s-]?chain|onchain|wallet\b/i, tag: 'On-chain' },
  { re: /\balpha\b|signal\b/i, tag: 'Alpha' },
  { re: /\beducat|hướng dẫn|guide|tutorial\b/i, tag: 'Education' },
  { re: /\bmacro|fed\b|btc\s*dominance\b/i, tag: 'Macro' },
]

export function suggestTagsFromText(text: string, limit = 8): string[] {
  if (!text || text.length < 40) return []
  const sample = text.slice(0, 12000)
  const hits: string[] = []
  for (const { re, tag } of TEXT_RULES) {
    if (re.test(sample)) hits.push(tag)
  }
  return normalizeTags(hits).slice(0, limit)
}

export function tagsFromMapKol(kol: {
  niche?: string
  niches?: string[]
}): string[] {
  const raw = [kol.niche, ...(kol.niches || [])].filter(Boolean) as string[]
  return normalizeTags(raw)
}

/**
 * Merge: current + map niches + text suggestions (no noise).
 * Does not remove user-chosen tags.
 */
export function smartMergeTags(
  current: string[] | undefined,
  opts?: {
    mapKol?: { niche?: string; niches?: string[] } | null
    text?: string
    max?: number
  },
): string[] {
  const max = opts?.max ?? 12
  const base = normalizeTags(current)
  const fromMap = opts?.mapKol ? tagsFromMapKol(opts.mapKol) : []
  const fromText = opts?.text ? suggestTagsFromText(opts.text) : []
  return normalizeTags([...base, ...fromMap, ...fromText]).slice(0, max)
}

/** Collect tag frequency from a list of reports */
export function collectTagStats(
  reports: Array<{ tags?: string[] }>,
): Array<{ tag: string; count: number }> {
  const m = new Map<string, { tag: string; count: number }>()
  for (const r of reports) {
    for (const t of displayTags(r.tags)) {
      const k = t.toLowerCase()
      const prev = m.get(k)
      if (prev) prev.count++
      else m.set(k, { tag: t, count: 1 })
    }
  }
  return [...m.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  )
}
