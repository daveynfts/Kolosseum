import type { Kol, KolRank, Niche } from '../types'
import { getKolRank, primaryNiche, RANK_RING_WIDTH } from '../types'

const RANK_RINGS: KolRank[] = [
  'challenger',
  'master',
  'diamond',
  'platinum',
  'gold',
]

/** Inner → outer base radii before packing expansion. */
const BASE_RING_R: Record<KolRank, number> = {
  challenger: 3.2,
  master: 5.8,
  diamond: 8.6,
  platinum: 11.4,
  gold: 14,
}

const RING_PHASE: Record<KolRank, number> = {
  challenger: 0.15,
  master: 0.52,
  diamond: 0.91,
  platinum: 1.28,
  gold: 1.67,
}

const Y_SQUASH = 0.82
const PACK_GAP = 0.38
const INTER_RING_GAP = 0.55
const Y_JITTER = 0.08
const Z_JITTER = 0.35
/** Keep the whole constellation inside the default camera frustum. */
const FIT_RADIUS = 16.8

const nicheOrder: Niche[] = [
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

function nicheIndex(kol: Kol): number {
  return Math.max(0, nicheOrder.indexOf(primaryNiche(kol)))
}

function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function signed(t: number): number {
  return t * 2 - 1
}

/** Disc radius for crisp billboard avatars (larger = clearer faces). */
export function radiusForScore(score: number): number {
  const t = Math.max(0, Math.min(1, (score - 10) / 90))
  // Min ~0.42, max ~1.35 — readable portrait discs
  return 0.42 + Math.pow(t, 0.9) * 0.93
}

/** Visual radius including KolBubble scale + rank bezel. */
export function visualBubbleRadius(kol: Kol): number {
  const rank = getKolRank(kol)
  return radiusForScore(kol.score) * 1.08 * RANK_RING_WIDTH[rank]
}

function minRingRadius(n: number, rMax: number): number {
  if (n <= 1) return 0
  const half = rMax + PACK_GAP
  const s = Math.sin(Math.PI / n)
  if (s < 1e-4) return n * half / Math.PI
  return half / s
}

function sortRing(a: Kol, b: Kol): number {
  const na = nicheIndex(a) - nicheIndex(b)
  if (na !== 0) return na
  const score = (b.score ?? 0) - (a.score ?? 0)
  if (score !== 0) return score
  return String(a.id).localeCompare(String(b.id))
}

/**
 * Rank constellation: Challenger at the center, Gold on the outer rim.
 * One pass over the full list so packing can respect neighbor size.
 */
export function layoutConstellation(
  kols: Kol[],
): Map<string, [number, number, number]> {
  const out = new Map<string, [number, number, number]>()
  if (!kols.length) return out

  const byRank = new Map<KolRank, Kol[]>()
  for (const rank of RANK_RINGS) byRank.set(rank, [])
  for (const kol of kols) {
    const rank = getKolRank(kol)
    const list = byRank.get(rank)
    if (list) list.push(kol)
    else byRank.set(rank, [kol])
  }
  for (const list of byRank.values()) list.sort(sortRing)

  let prevOuter = 0
  let maxExtent = 0
  const raw = new Map<string, [number, number, number]>()

  for (let ri = 0; ri < RANK_RINGS.length; ri++) {
    const rank = RANK_RINGS[ri]
    const members = byRank.get(rank) || []
    if (!members.length) continue

    let rMax = 0
    for (const k of members) rMax = Math.max(rMax, visualBubbleRadius(k))

    const n = members.length
    const packed = minRingRadius(n, rMax)
    const afterPrev = prevOuter + rMax + INTER_RING_GAP
    const R =
      n === 1 && rank === 'challenger'
        ? 0
        : Math.max(BASE_RING_R[rank], packed, afterPrev)
    const phase = RING_PHASE[rank]

    for (let i = 0; i < n; i++) {
      const kol = members[i]
      const theta = phase + (n === 0 ? 0 : (i / n) * Math.PI * 2)
      const yJ = signed(hash01(kol.id, 11)) * Y_JITTER * Math.max(R, 1)
      const zJ = signed(hash01(kol.id, 29)) * Z_JITTER * Math.max(R, 1)
      const x = R * Math.cos(theta)
      const y = R * Math.sin(theta) * Y_SQUASH + yJ
      const z = zJ
      raw.set(kol.id, [x, y, z])
      maxExtent = Math.max(maxExtent, Math.hypot(x, y) + visualBubbleRadius(kol))
    }

    prevOuter = R + rMax
  }

  const scale = maxExtent > FIT_RADIUS ? FIT_RADIUS / maxExtent : 1
  for (const kol of kols) {
    const p = raw.get(kol.id)
    if (!p) continue
    out.set(kol.id, [p[0] * scale, p[1] * scale, p[2] * scale])
  }
  return out
}

/** Fibonacci sphere + niche cluster bias — legacy cloud. Prefer layoutConstellation. */
export function positionForKol(
  kol: Kol,
  index: number,
  total: number,
): [number, number, number] {
  const nIndex = nicheIndex(kol)
  const clusterAngle = (nIndex / nicheOrder.length) * Math.PI * 2

  const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(1, total))
  const theta = Math.PI * (1 + Math.sqrt(5)) * index

  const radius = 10.6 + (1 - kol.score / 100) * 5.8

  let x = radius * Math.sin(phi) * Math.cos(theta)
  let y = radius * Math.cos(phi)
  let z = radius * Math.sin(phi) * Math.sin(theta)

  const pull = 3.2
  x += Math.cos(clusterAngle) * pull * 0.55
  z += Math.sin(clusterAngle) * pull * 0.55
  y += (nIndex - nicheOrder.length / 2) * 0.2

  if (kol.tier === 1) {
    x *= 0.94
    y *= 0.94
    z *= 0.94
  }

  return [x, y, z]
}

export type ViewMode = '3d' | '2d'

/**
 * @deprecated Use layoutConstellation(kols) — per-item 2.5D cloud.
 */
export function positionForKol25d(
  kol: Kol,
  index: number,
  total: number,
): [number, number, number] {
  const [x, y, z] = positionForKol(kol, index, total)
  return [x * 1.02, y * 0.78, z * 1.02]
}

/** @deprecated use layoutConstellation */
export const positionForKol2d = positionForKol25d
