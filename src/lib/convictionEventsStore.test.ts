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

  it('requests the edition slug on GET', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return new Response(JSON.stringify(CONVICTION_EVENTS_SEED), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
    await loadEventsWithSource({ slug: 'conviction-2026' })
    expect(urls[0]).toContain('event=conviction-2026')
  })

  it('admin cache round-trips hidden events', async () => {
    const hiddenSeed = {
      ...CONVICTION_EVENTS_SEED,
      events: [
        ...CONVICTION_EVENTS_SEED.events,
        {
          ...CONVICTION_EVENTS_SEED.events[0],
          id: 'hidden-test-event',
          title: 'Hidden test',
          hidden: true,
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(hiddenSeed), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
    const admin = await loadEventsWithSource({
      includeHidden: true,
      slug: 'conviction-2026',
    })
    expect(admin.dataset.events.some((e) => e.id === 'hidden-test-event')).toBe(
      true,
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('fail', { status: 503 })),
    )
    const offline = await loadEventsWithSource({
      includeHidden: true,
      slug: 'conviction-2026',
    })
    expect(offline.source).toBe('cache')
    expect(
      offline.dataset.events.some((e) => e.id === 'hidden-test-event'),
    ).toBe(true)
  })
})
