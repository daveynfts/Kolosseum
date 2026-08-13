// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadKolReportsWithSource } from './kolReportsStore'

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
})

describe('loadKolReportsWithSource', () => {
  it('does not fall back to seed when token is rejected', async () => {
    sessionStorage.setItem('vn-kol-feed-admin-token', 'bad-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"unauthorized"}', { status: 401 })),
    )
    const r = await loadKolReportsWithSource('bad-token')
    expect(r.source).toBe('unauthorized')
    expect(r.dataset.reports).toEqual([])
  })
})
