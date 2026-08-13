// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONVICTION_EVENTS_SEED } from '../data/convictionEvents'
import {
  CONVICTION_EVENTS_EVENT,
  loadEventsWithSource,
} from './convictionEventsStore'

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
})

describe('loadEventsWithSource', () => {
  it('does not emit CONVICTION_EVENTS_EVENT when caching a successful GET', async () => {
    const fired: string[] = []
    window.addEventListener(CONVICTION_EVENTS_EVENT, () => fired.push('emit'))
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(CONVICTION_EVENTS_SEED), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const r = await loadEventsWithSource()
    expect(r.source).toBe('server')
    expect(fired).toEqual([])
  })
})
