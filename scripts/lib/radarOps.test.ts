import { describe, expect, it } from 'vitest'
import {
  normalizeHandle,
  parseArgs,
  parseFollowerFile,
  pickTimestamp,
} from './radarOps.mjs'
import { adminGetUrl } from './adminPut.mjs'

describe('radar CLI helpers', () => {
  it('parses flags and --unhide', () => {
    expect(parseArgs(['--handle', 'Foo', '--unhide']).flags).toEqual({
      handle: 'Foo',
      unhide: true,
    })
  })

  it('normalizes handles', () => {
    expect(normalizeHandle('@HakResearch')).toBe('hakresearch')
  })

  it('parses follower JSON shapes', () => {
    expect(parseFollowerFile('[{"handle":"a"}]')).toEqual([{ handle: 'a' }])
    expect(parseFollowerFile({ followers: [{ handle: 'b' }] })).toEqual([
      { handle: 'b' },
    ])
    expect(() => parseFollowerFile({ ok: true })).toThrow(/array/)
  })

  it('picks the first valid ISO field', () => {
    expect(
      pickTimestamp(
        { generatedAt: '2026-08-17T04:30:22.781Z' },
        ['generatedAt', 'updatedAt'],
      ),
    ).toBe('2026-08-17T04:30:22.781Z')
  })
})

describe('adminGetUrl', () => {
  it('adds ?all=1 for datasets whose public GET strips rows', () => {
    expect(adminGetUrl('https://radar.daveynfts.com/api/scex-tracking')).toMatch(
      /all=1/,
    )
    expect(adminGetUrl('https://radar.daveynfts.com/api/kols')).toMatch(/all=1/)
    expect(adminGetUrl('https://radar.daveynfts.com/api/feed')).not.toMatch(
      /all=1/,
    )
  })
})
