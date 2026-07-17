/**
 * TwitterScore Top N (100→200+) — internal benchmark data.
 *
 * Source of truth (repo seed):
 *   src/data/internal/twitterscore-top100.json
 *   data/internal/twitterscore-top100.json  (mirror for agents / offline)
 *
 * Runtime (admin): R2 `internal/twitterscore-top100/v1.json` via
 *   GET/PUT /api/twitterscore-top100
 *   → cached in localStorage after load
 *
 * Score = follower-network influence 0–1000 (twitterscore.io),
 * NOT content accuracy or investment performance.
 * Filename keeps top100 for stable R2/API keys; listSize is dynamic.
 */
import seedJson from './internal/twitterscore-top100.json'

export interface TwitterScoreAccount {
  rank: number
  handle: string
  displayName: string
  /** TwitterScore 0–1000 */
  score: number
}

export type TwitterScoreDataset = {
  version: number
  kind: 'twitterscore-top100' | 'twitterscore-top200' | string
  asOf: string
  source: string
  sourceNote: string
  maxScore: number
  /** Score of rank #100 (compat) */
  top100Threshold: number
  /** Lowest score in current list (e.g. #200) */
  top200Threshold?: number
  listSize?: number
  median: number
  mean: number
  atMax: number
  accounts: TwitterScoreAccount[]
  updatedAt?: string
  note?: string
}

export function normalizeTwitterScoreDataset(
  raw: unknown,
): TwitterScoreDataset | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const accountsRaw = o.accounts
  if (!Array.isArray(accountsRaw) || !accountsRaw.length) return null
  const accounts: TwitterScoreAccount[] = []
  for (const row of accountsRaw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const handle = String(r.handle || '')
      .replace(/^@/, '')
      .trim()
    if (!handle) continue
    const score = Number(r.score)
    const rank = Number(r.rank)
    accounts.push({
      handle,
      displayName: String(r.displayName || handle).trim() || handle,
      score: Number.isFinite(score) ? score : 0,
      rank: Number.isFinite(rank) ? rank : accounts.length + 1,
    })
  }
  if (!accounts.length) return null
  // Re-sort by score desc, then rank, re-number ranks for consistency when admin edits
  accounts.sort(
    (a, b) =>
      b.score - a.score || a.rank - b.rank || a.handle.localeCompare(b.handle),
  )
  accounts.forEach((a, i) => {
    a.rank = i + 1
  })

  const scores = accounts.map((a) => a.score)
  const sum = scores.reduce((s, n) => s + n, 0)
  const mean = sum / scores.length
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  const maxScore = Math.max(...scores, 1000)
  const atMax = scores.filter((s) => s >= maxScore).length

  const listSize = accounts.length
  const scoreAt100 = accounts.find((a) => a.rank === 100)?.score
  const minScore = sorted[0] || 0
  return {
    version: Number(o.version) || 1,
    kind: String(o.kind || (listSize > 100 ? 'twitterscore-top200' : 'twitterscore-top100')),
    asOf: String(o.asOf || new Date().toISOString()),
    source: String(o.source || 'https://twitterscore.io/topScored/'),
    sourceNote: String(
      o.sourceNote ||
        'twitterscore.io · Top accounts by follower-network influence score',
    ),
    maxScore,
    top100Threshold:
      Number(o.top100Threshold) || scoreAt100 || minScore || 0,
    top200Threshold:
      Number(o.top200Threshold) || (listSize >= 200 ? minScore : undefined),
    listSize,
    median: Number(o.median) || median,
    mean: Number(o.mean) || mean,
    atMax: Number(o.atMax) || atMax,
    accounts,
    updatedAt: o.updatedAt ? String(o.updatedAt) : undefined,
    note: o.note ? String(o.note) : undefined,
  }
}

/** Compiled seed from internal JSON (always available offline). */
export const TWITTER_SCORE_SEED: TwitterScoreDataset =
  normalizeTwitterScoreDataset(seedJson) || {
    version: 1,
    kind: 'twitterscore-top100',
    asOf: new Date().toISOString(),
    source: 'https://twitterscore.io/topScored/',
    sourceNote: 'empty seed',
    maxScore: 1000,
    top100Threshold: 0,
    median: 0,
    mean: 0,
    atMax: 0,
    accounts: [],
  }

/** @deprecated use dataset.accounts — kept for existing imports */
export const TWITTER_SCORE_TOP_100: TwitterScoreAccount[] =
  TWITTER_SCORE_SEED.accounts

/** @deprecated use dataset fields — kept for existing imports */
export const TWITTER_SCORE_SNAPSHOT = {
  asOf: TWITTER_SCORE_SEED.asOf,
  source: TWITTER_SCORE_SEED.source,
  sourceNote: TWITTER_SCORE_SEED.sourceNote,
  maxScore: TWITTER_SCORE_SEED.maxScore,
  top100Threshold: TWITTER_SCORE_SEED.top100Threshold,
  median: TWITTER_SCORE_SEED.median,
  mean: TWITTER_SCORE_SEED.mean,
  atMax: TWITTER_SCORE_SEED.atMax,
} as const

export function getTwitterScoreAccount(
  handle: string,
  accounts: TwitterScoreAccount[] = TWITTER_SCORE_TOP_100,
): TwitterScoreAccount | undefined {
  const key = handle.replace(/^@/, '').trim().toLowerCase()
  return accounts.find((a) => a.handle.toLowerCase() === key)
}

export function isTwitterScoreTop100(
  handle: string,
  accounts: TwitterScoreAccount[] = TWITTER_SCORE_TOP_100,
): boolean {
  return !!getTwitterScoreAccount(handle, accounts)
}

export function searchTwitterScoreTop100(
  query: string,
  accounts: TwitterScoreAccount[] = TWITTER_SCORE_TOP_100,
): TwitterScoreAccount[] {
  const q = query.trim().toLowerCase().replace(/^@/, '')
  if (!q) return accounts
  return accounts.filter(
    (a) =>
      a.handle.toLowerCase().includes(q) ||
      a.displayName.toLowerCase().includes(q) ||
      String(a.rank) === q ||
      String(a.score).includes(q),
  )
}

/** Recompute mean/median/atMax after admin edits (preserves asOf/source). */
export function recomputeTwitterScoreStats(
  dataset: TwitterScoreDataset,
): TwitterScoreDataset {
  return (
    normalizeTwitterScoreDataset({
      ...dataset,
      // force recompute from accounts
      median: undefined,
      mean: undefined,
      atMax: undefined,
      maxScore: undefined,
    }) || dataset
  )
}
