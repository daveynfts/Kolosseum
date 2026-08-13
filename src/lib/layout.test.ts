import { describe, expect, it } from 'vitest'
import type { Kol, KolRank, Niche } from '../types'
import { layoutConstellation } from './layout'

function kol(
  id: string,
  rank: KolRank,
  score: number,
  niche: Niche = 'Trading',
): Kol {
  return {
    id,
    handle: id,
    displayName: id,
    niche,
    rank,
    smartFollowers: 0,
    followers: 1000,
    posts24h: 0,
    likes24h: 0,
    replies24h: 0,
    reposts24h: 0,
    baseScore: score,
    hotScore: 0,
    score,
    deltaPct: 0,
    bio: '',
  }
}

describe('layoutConstellation', () => {
  it('places every id at a finite XYZ', () => {
    const kols = [
      kol('c1', 'challenger', 98),
      kol('m1', 'master', 90, 'News'),
      kol('g1', 'gold', 40, 'NFT'),
    ]
    const map = layoutConstellation(kols)
    expect(map.size).toBe(3)
    for (const k of kols) {
      const p = map.get(k.id)
      expect(p).toBeDefined()
      expect(p!.every((n) => Number.isFinite(n))).toBe(true)
    }
  })

  it('keeps challenger closer to origin than gold on average', () => {
    const kols = [
      kol('c1', 'challenger', 99),
      kol('c2', 'challenger', 97, 'Research'),
      kol('g1', 'gold', 45),
      kol('g2', 'gold', 42, 'News'),
      kol('g3', 'gold', 40, 'NFT'),
    ]
    const map = layoutConstellation(kols)
    const dist = (id: string) => {
      const [x, y] = map.get(id)!
      return Math.hypot(x, y)
    }
    const c = (dist('c1') + dist('c2')) / 2
    const g = (dist('g1') + dist('g2') + dist('g3')) / 3
    expect(c).toBeLessThan(g)
  })

  it('does not NaN for a single challenger', () => {
    const map = layoutConstellation([kol('solo', 'challenger', 99)])
    const p = map.get('solo')!
    expect(p.every((n) => Number.isFinite(n))).toBe(true)
  })

  it('is stable for the same id set', () => {
    const kols = [
      kol('a', 'master', 88),
      kol('b', 'gold', 50, 'DeFi'),
    ]
    const a = layoutConstellation(kols)
    const b = layoutConstellation([...kols].reverse())
    expect(a.get('a')).toEqual(b.get('a'))
    expect(a.get('b')).toEqual(b.get('b'))
  })
})
