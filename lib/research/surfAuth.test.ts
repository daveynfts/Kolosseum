import { describe, expect, it, vi } from 'vitest'
import { checkSurfAuth } from './surfAuth'

describe('Surf authentication preflight', () => {
  it('checks the documented gateway balance endpoint with Bearer auth', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }))
    expect(await checkSurfAuth({
      apiKey: 'test-only-key',
      baseUrl: 'https://api.asksurf.ai/gateway/',
      fetcher: fetcher as typeof fetch,
    })).toBe('valid')
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.href).toBe('https://api.asksurf.ai/gateway/v1/me/credit-balance')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-only-key' })
  })

  it.each([
    [401, 'invalid'],
    [402, 'no-credits'],
    [503, 'unavailable'],
  ] as const)('classifies HTTP %i as %s without a Chat charge', async (status, expected) => {
    expect(await checkSurfAuth({
      apiKey: 'test-only-key',
      fetcher: async () => new Response('{}', { status }),
    })).toBe(expected)
  })

  it('does not request anything without a key or over remote HTTP', async () => {
    const fetcher = vi.fn(async () => new Response('{}'))
    expect(await checkSurfAuth({ apiKey: '', fetcher })).toBe('missing')
    expect(await checkSurfAuth({ apiKey: 'test-only-key', baseUrl: 'http://example.com', fetcher })).toBe('unavailable')
    expect(fetcher).not.toHaveBeenCalled()
  })
})