// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCEX_TRACKING_SEED } from '../data/scexTracking'
import { loadScexWithSource, SCEX_TRACKING_EVENT } from './scexStore'

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
})

describe('loadScexWithSource', () => {
  it('does not emit SCEX_TRACKING_EVENT when caching a successful GET', async () => {
    const fired: string[] = []
    window.addEventListener(SCEX_TRACKING_EVENT, () => fired.push('emit'))
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(SCEX_TRACKING_SEED), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const r = await loadScexWithSource()
    expect(r.source).toBe('server')
    expect(fired).toEqual([])
  })
})
