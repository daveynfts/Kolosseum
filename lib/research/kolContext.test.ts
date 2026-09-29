import { describe, expect, it } from 'vitest'
import { defaultScexConfig } from '../../src/data/scexTracking'
import { loadKolContext } from './kolContext'

describe('source coverage for tracked Arena accounts', () => {
  const fetcher = (async (url: string | URL | Request) => Response.json(String(url).endsWith('/api/kols') ? { kols: [] } : {
    config: defaultScexConfig(), asOf: '2026-09-20',
    actors: [{ id: 'a_helenvn88', handle: 'helenvn88', displayName: 'Helen Apes', kind: 'user', followers: 2694, postsVolume: 1, qualityScore: 45.5, sentiment: 'neutral', isWhitelisted: true }],
    posts: [{ id: 'p1', handle: 'helenvn88', url: 'https://x.com/helenvn88/status/123', text: 'Observed post', postedAt: '2026-09-19', sentiment: 'neutral', likes: 0, replies: 0, reposts: 0, views: 24 }],
  })) as typeof fetch
  it('allows tracked user accounts explicitly without changing legacy KOL-only behavior', async () => {
    await expect(loadKolContext('helenvn88', { fetcher })).rejects.toThrow('KOL not found')
    const context = await loadKolContext('helenvn88', { fetcher, includeTrackedAccounts: true })
    expect(context.actor.handle).toBe('helenvn88'); expect(context.posts).toHaveLength(1)
    expect(context.posts[0].text).toBe('Observed post')
  })
  it('rejects missing and invalid handles before allowing a paid quote', async () => {
    await expect(loadKolContext('missing', { fetcher, includeTrackedAccounts: true })).rejects.toThrow('not found')
    await expect(loadKolContext('../private', { fetcher, includeTrackedAccounts: true })).rejects.toThrow('Invalid X handle')
  })
})
