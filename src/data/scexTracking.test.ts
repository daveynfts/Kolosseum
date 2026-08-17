import { describe, expect, it } from 'vitest'
import {
  audienceTrustScore,
  computeQuadrant,
  defaultScexConfig,
  dominantScexSentiment,
  inferScexSentiment,
  isScexEventTaskSpam,
  recomputeScexSentiments,
  scoreScexActor,
  type ScexActor,
  type ScexDataset,
  type ScexPost,
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

describe('isScexEventTaskSpam', () => {
  it('flags the XNXX_EN + SCEX + Conviction mention cluster', () => {
    expect(
      isScexEventTaskSpam(
        '@XNXX_EN @scexofficial @Convictionvn Vietnam crypto growing',
      ),
    ).toBe(true)
    expect(
      isScexEventTaskSpam(
        '@xnxx_en  @SCEXofficial   @convictionvn GM',
      ),
    ).toBe(true)
  })

  it('keeps real SCEX mentions', () => {
    expect(
      isScexEventTaskSpam('Chúc mừng @scexofficial hợp tác Conviction'),
    ).toBe(false)
    expect(isScexEventTaskSpam('@scexofficial demo hay')).toBe(false)
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

describe('inferScexSentiment', () => {
  it('tags partnership / MOU news as bullish (not bearish)', () => {
    const text =
      'SCEX VÀ IVY KÝ KẾT HỢP TÁC CHIẾN LƯỢC nhằm thúc đẩy hệ sinh thái tài sản số tại Việt Nam'
    expect(inferScexSentiment(text)).toBe('bullish')
  })

  it('tags hard product dismissal as bearish', () => {
    expect(
      inferScexSentiment(
        'SCEX có bác nào đăng kí được sàn chưa? Chứ mình test thì thấy không ra gì rồi.',
      ),
    ).toBe('bearish')
  })

  it('tags mild demo critique as neutral', () => {
    expect(
      inferScexSentiment(
        'Test thử demo sàn SCEX, hơi lag nhẹ, đơn sơ. Mong làm mượt chút.',
      ),
    ).toBe('neutral')
  })

  it('tags sponsorship / awards as bullish', () => {
    expect(
      inferScexSentiment(
        'Chúc mừng SCEX trở thành Nhà tài trợ Vàng của Vietnam RWA Summit 2026',
      ),
    ).toBe('bullish')
  })

  it('does not treat “rắc rối” (hassle) as hard negative', () => {
    expect(
      inferScexSentiment(
        '@KT_BTC @scexofficial thế càng đỡ rắc rối cho anh em dùng sau này bro',
      ),
    ).not.toBe('bearish')
  })
})

describe('recomputeScexSentiments', () => {
  it('fixes actor ring when sole post was mislabeled partnership news', () => {
    const post: ScexPost = {
      id: 'p1',
      handle: 'gm_upside',
      url: 'https://x.com/x/status/1',
      text: 'SCEX và IVY ký kết hợp tác chiến lược, thúc đẩy hệ sinh thái tài sản số',
      postedAt: '2026-08-01T00:00:00.000Z',
      sentiment: 'bearish',
    }
    const ds: ScexDataset = {
      version: 1,
      kind: 'scex',
      asOf: '2026-08-11',
      config: defaultScexConfig(),
      actors: [
        baseActor({
          id: 'a1',
          handle: 'gm_upside',
          sentiment: 'bearish',
        }),
      ],
      posts: [post],
    }
    const next = recomputeScexSentiments(ds)
    expect(next.posts[0].sentiment).toBe('bullish')
    expect(next.actors[0].sentiment).toBe('bullish')
  })

  it('dominantScexSentiment prefers clear majority', () => {
    expect(
      dominantScexSentiment([
        { sentiment: 'bullish' },
        { sentiment: 'bullish' },
        { sentiment: 'neutral' },
      ]),
    ).toBe('bullish')
  })
})
