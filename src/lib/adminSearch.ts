import type { Kol } from '../types'
import {
  formatRank,
  formatStatus,
  getKolNiches,
  getKolRank,
  RANK_LABELS,
  STATUS_EMOJI,
  STATUS_LABELS,
} from '../types'

/** Normalize admin search: trim, lower, strip leading @, collapse spaces */
export function normalizeAdminQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ')
}

/** Split into tokens for AND matching. Empty query → [] (match all). */
export function adminQueryTokens(raw: string): string[] {
  const q = normalizeAdminQuery(raw)
  if (!q) return []
  return q.split(' ').filter(Boolean)
}

/** Haystack fields for a KOL used by admin list/edit filter. */
export function kolSearchHaystack(k: Kol): string {
  const rank = getKolRank(k)
  const niches = getKolNiches(k)
  const status = k.statusLabel
  const parts = [
    k.handle,
    k.displayName,
    k.bio || '',
    k.typeRaw || '',
    k.niche || '',
    niches.join(' '),
    formatRank(k),
    RANK_LABELS[rank],
    rank,
    status || '',
    status ? STATUS_LABELS[status] : '',
    status ? STATUS_EMOJI[status] : '',
    status ? formatStatus(status) : '',
    k.city || '',
    k.hidden ? 'hidden' : '',
    String(k.tier ?? ''),
    `t${k.tier ?? ''}`,
  ]
  return parts.join(' ').toLowerCase()
}

/** True if every token appears somewhere in the haystack (AND). */
export function matchesAdminTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const h = haystack.toLowerCase()
  return tokens.every((t) => {
    // Token may still carry @ if user typed mid-string "@foo bar"
    const tok = t.replace(/^@+/, '')
    if (!tok) return true
    return h.includes(tok)
  })
}

export function kolMatchesAdminQuery(k: Kol, rawQuery: string): boolean {
  const tokens = adminQueryTokens(rawQuery)
  if (tokens.length === 0) return true
  return matchesAdminTokens(kolSearchHaystack(k), tokens)
}

/** Handle/name match with @ strip — feed sidebar, followers picker, etc. */
export function handleNameMatches(
  handle: string,
  displayName: string | undefined,
  rawQuery: string,
  extra?: string,
): boolean {
  const tokens = adminQueryTokens(rawQuery)
  if (tokens.length === 0) return true
  const hay = [handle, displayName || '', extra || ''].join(' ').toLowerCase()
  return matchesAdminTokens(hay, tokens)
}
