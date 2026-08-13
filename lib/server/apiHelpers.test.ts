// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assertNotStale,
  isGetOrHead,
  readBaseUpdatedAt,
} from './apiHelpers.js'
import { checkRateLimit } from './rateLimit.js'

describe('assertNotStale', () => {
  it('allows first write when server has no timestamp', () => {
    expect(assertNotStale(null, null)).toEqual({ ok: true })
    expect(assertNotStale(undefined, '2026-07-27T10:00:00.000Z')).toEqual({
      ok: true,
    })
  })

  it('rejects when client base is missing but server exists', () => {
    expect(assertNotStale('2026-07-27T10:00:00.000Z', null)).toEqual({
      ok: false,
      serverUpdatedAt: '2026-07-27T10:00:00.000Z',
    })
  })

  it('rejects invalid client timestamp when server exists', () => {
    expect(
      assertNotStale('2026-07-27T10:00:00.000Z', 'not-a-date'),
    ).toEqual({
      ok: false,
      serverUpdatedAt: '2026-07-27T10:00:00.000Z',
    })
  })

  it('allows when server is not newer', () => {
    expect(
      assertNotStale(
        '2026-07-27T10:00:00.000Z',
        '2026-07-27T10:00:00.000Z',
      ),
    ).toEqual({ ok: true })
  })

  it('rejects when server is newer than client base', () => {
    const r = assertNotStale(
      '2026-07-27T12:00:00.000Z',
      '2026-07-27T10:00:00.000Z',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.serverUpdatedAt).toBe('2026-07-27T12:00:00.000Z')
    }
  })
})

describe('readBaseUpdatedAt', () => {
  it('reads baseUpdatedAt or clientUpdatedAt', () => {
    expect(readBaseUpdatedAt({ baseUpdatedAt: 'a' })).toBe('a')
    expect(readBaseUpdatedAt({ clientUpdatedAt: 'b' })).toBe('b')
    expect(readBaseUpdatedAt({})).toBeUndefined()
  })
})

describe('checkRateLimit', () => {
  it('blocks after max within window', () => {
    const t0 = 1_000_000
    expect(checkRateLimit('ip1', 2, 60_000, t0).ok).toBe(true)
    expect(checkRateLimit('ip1', 2, 60_000, t0 + 1).ok).toBe(true)
    const blocked = checkRateLimit('ip1', 2, 60_000, t0 + 2)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
})

describe('isGetOrHead', () => {
  it('accepts GET and HEAD only', () => {
    expect(isGetOrHead('GET')).toBe(true)
    expect(isGetOrHead('HEAD')).toBe(true)
    expect(isGetOrHead('PUT')).toBe(false)
    expect(isGetOrHead(undefined)).toBe(false)
  })
})
