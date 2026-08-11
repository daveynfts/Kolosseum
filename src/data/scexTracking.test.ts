import { describe, expect, it } from 'vitest'
import {
  audienceTrustScore,
  computeQuadrant,
  defaultScexConfig,
  scoreScexActor,
  type ScexActor,
} from './scexTracking'

describe('computeQuadrant', () => {
  const vSplit = 50
  const qSplit = 50

  it('maps high volume + high quality to stars', () => {
    expect(computeQuadrant(60, 60, vSplit, qSplit)).toBe('stars')
  })

  it('maps low volume + high quality to nurture', () => {
    expect(computeQuadrant(40, 60, vSplit, qSplit)).toBe('nurture')
  })

  it('maps high volume + low quality to noise', () => {
    expect(computeQuadrant(60, 40, vSplit, qSplit)).toBe('noise')
  })

  it('maps low volume + low quality to ignore', () => {
    expect(computeQuadrant(40, 40, vSplit, qSplit)).toBe('ignore')
  })
})

describe('audienceTrustScore', () => {
  it('rises with followers and stays below map diamond (78)', () => {
    expect(audienceTrustScore(500)).toBeLessThan(audienceTrustScore(25_000))
    expect(audienceTrustScore(25_000)).toBeLessThan(audienceTrustScore(100_000))
    expect(audienceTrustScore(300_000)).toBeLessThan(78)
    // Micro accounts near old floor; large KOLs clearly higher
    expect(audienceTrustScore(500)).toBeLessThan(46)
    expect(audienceTrustScore(50_000)).toBeGreaterThan(56)
  })
})

function baseActor(patch: Partial<ScexActor>): ScexActor {
  return {
    id: 't1',
    handle: 'testkol',
    displayName: 'Test',
    kind: 'kol',
    followers: 1000,
    postsVolume: 1,
    qualityScore: 50,
    sentiment: 'neutral',
    gocPosts: 1,
    replyPosts: 0,
    reach7d: 2000,
    ...patch,
  }
}

describe('scoreScexActor quality / uy tín', () => {
  const config = defaultScexConfig()

  it('does not score all off-map accounts as the same flat map=40', () => {
    const small = scoreScexActor(
      baseActor({ handle: 'small', followers: 600, reach7d: 300 }),
      config,
    )
    const big = scoreScexActor(
      baseActor({
        handle: 'bigkol',
        followers: 80_000,
        reach7d: 40_000,
        sentiment: 'bullish',
      }),
      config,
    )
    expect(big.qualityScore).toBeGreaterThan(small.qualityScore + 5)
    // Large off-map KOL clears partner mid-line; micro stays lower
    expect(big.qualityScore).toBeGreaterThan(58)
    expect(small.qualityScore).toBeLessThan(big.qualityScore - 5)
    expect(big.scoreLog || '').toMatch(/audience:/)
    expect(small.scoreLog || '').toMatch(/audience:/)
  })

  it('preserves stored mapRank when map join is missing', () => {
    const scored = scoreScexActor(
      baseActor({
        handle: 'onmap',
        followers: 40_000,
        mapRank: 'master',
        sentiment: 'bullish',
      }),
      config,
      // no mapKol
    )
    expect(scored.mapRank).toBe('master')
    expect(scored.qualityScore).toBeGreaterThan(70)
    expect(scored.scoreLog || '').toMatch(/map=master/)
  })

  it('does not treat follower-band tier labels as Radar ranks', () => {
    // Export scripts set tier=Challenger for ~3k followers — not map Challenger
    const scored = scoreScexActor(
      baseActor({
        handle: 'fakechallenger',
        followers: 3500,
        tier: 'Challenger',
        mapRank: undefined,
      }),
      config,
    )
    expect(scored.mapRank).toBeUndefined()
    expect(scored.scoreLog || '').toMatch(/audience:/)
    expect(scored.scoreLog || '').not.toMatch(/map=challenger/)
  })

  it('gives map-verified diamond higher quality than off-map same size', () => {
    const off = scoreScexActor(
      baseActor({
        handle: 'off',
        followers: 30_000,
        sentiment: 'bullish',
      }),
      config,
    )
    const on = scoreScexActor(
      baseActor({
        handle: 'on',
        followers: 30_000,
        sentiment: 'bullish',
      }),
      config,
      { handle: 'on', rank: 'diamond' },
    )
    expect(on.qualityScore).toBeGreaterThan(off.qualityScore)
    expect(on.mapRank).toBe('diamond')
  })
})
