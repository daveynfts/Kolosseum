import type { Kol, Niche } from '../types'

/** Fibonacci sphere + niche cluster bias for a readable 3D cloud */
export function positionForKol(
  kol: Kol,
  index: number,
  total: number,
): [number, number, number] {
  const nicheIndex = Math.max(0, nicheOrder.indexOf(kol.niche))
  const clusterAngle = (nicheIndex / nicheOrder.length) * Math.PI * 2

  const phi = Math.acos(1 - (2 * (index + 0.5)) / total)
  const theta = Math.PI * (1 + Math.sqrt(5)) * index

  // Spread cloud so larger avatars don't overlap as much
  const radius = 9.5 + (1 - kol.score / 100) * 5.5

  let x = radius * Math.sin(phi) * Math.cos(theta)
  let y = radius * Math.cos(phi)
  let z = radius * Math.sin(phi) * Math.sin(theta)

  const pull = 3.2
  x += Math.cos(clusterAngle) * pull * 0.55
  z += Math.sin(clusterAngle) * pull * 0.55
  y += (nicheIndex - nicheOrder.length / 2) * 0.2

  if (kol.tier === 1) {
    x *= 0.9
    y *= 0.9
    z *= 0.9
  }

  return [x, y, z]
}

/** Disc radius for crisp billboard avatars (larger = clearer faces). */
export function radiusForScore(score: number): number {
  const t = Math.max(0, Math.min(1, (score - 10) / 90))
  // Min ~0.42, max ~1.35 — readable portrait discs
  return 0.42 + Math.pow(t, 0.9) * 0.93
}

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

export type ViewMode = '3d' | '2d'

/**
 * 2.5D layout: same 3D sphere cloud as full mode, slightly squashed on Y
 * so depth reads clearly while billboard faces stay readable (parallax orbit).
 */
export function positionForKol25d(
  kol: Kol,
  index: number,
  total: number,
): [number, number, number] {
  const [x, y, z] = positionForKol(kol, index, total)
  // Keep full XZ depth; mild Y squash for a “stage” 2.5D feel
  return [x * 1.02, y * 0.78, z * 1.02]
}

/** @deprecated use positionForKol25d — kept as alias */
export const positionForKol2d = positionForKol25d
