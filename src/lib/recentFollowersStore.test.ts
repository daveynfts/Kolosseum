// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  mergeFollowersMapsForPublish,
  mergeSmartFollowersMapsForPublish,
  normalizeMap,
  normalizeSmartMap,
} from './recentFollowersStore'

describe('recentFollowers merge', () => {
  it('server map is overlaid by local edits', () => {
    const server = { alpha: [{ handle: 'a', displayName: 'A', followedAgo: '1d' }] }
    const local = {
      beta: [{ handle: 'b', displayName: 'B', followedAgo: '2d' }],
      alpha: [{ handle: 'a2', displayName: 'A2', followedAgo: '3d' }],
    }
    const merged = mergeFollowersMapsForPublish(server, local)
    expect(merged.alpha[0].handle).toBe('a2')
    expect(merged.beta[0].handle).toBe('b')
  })

  it('smart map merges seed + server + local', () => {
    const seed = { kol1: [{ handle: 's1', displayName: 'S1' }] }
    const server = { kol2: [{ handle: 's2', displayName: 'S2' }] }
    const local = { kol2: [{ handle: 's2b', displayName: 'S2B', role: 'Tier A' }] }
    const merged = mergeSmartFollowersMapsForPublish(server, local, seed)
    expect(merged.kol1[0].handle).toBe('s1')
    expect(merged.kol2[0].handle).toBe('s2b')
  })

  it('normalizeMap lowercases KOL keys and follower handles', () => {
    const m = normalizeMap({
      Alpha: [{ handle: '@Beta', displayName: 'B', followedAgo: 'recently' }],
    })
    expect(m.alpha?.[0].handle).toBe('beta')
    expect(m.beta).toBeUndefined()
  })

  it('normalizeSmartMap drops invalid rows', () => {
    const m = normalizeSmartMap({
      kol: [{ handle: '', displayName: 'x' }, { handle: 'ok', displayName: 'OK' }],
    })
    expect(m.kol).toHaveLength(1)
    expect(m.kol[0].handle).toBe('ok')
  })
})
