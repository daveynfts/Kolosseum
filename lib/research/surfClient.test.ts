import { describe, expect, it, vi } from 'vitest'
import { askSurf } from './surfClient'

describe('Surf client', () => {
  it('retries a transient server response and caches the completed result for the hour', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed', model: 'surf-2.0', output_text: '## Summary\nNguồn thật',
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        meta: { credits_used: 50 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const options = {
      cacheIdentity: 'retry-cache-unit', input: 'sample', instructions: 'system',
      apiKey: 'test-key', baseUrl: 'http://127.0.0.1:9999', fetcher: fetcher as typeof fetch,
      now: 1_800_000_000_000,
    }
    const first = await askSurf(options)
    const second = await askSurf(options)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.usage).toMatchObject({ creditsUsed: 50, cacheHit: false, totalTokens: 30 })
    expect(second.usage).toMatchObject({ creditsUsed: 0, cacheHit: true })
    expect(second.text).toBe(first.text)
  })

  it('does not retry an authentication failure', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    await expect(askSurf({
      cacheIdentity: 'auth-failure-unit', input: 'sample', instructions: 'system',
      apiKey: 'test-key', baseUrl: 'http://127.0.0.1:9999', fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('Surf returned HTTP 401')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
