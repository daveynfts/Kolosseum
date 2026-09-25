import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { askSurf } from './surfClient'

describe('Surf client', () => {
  it('retries an explicitly permitted transient response and caches the completed result for the hour', async () => {
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
      now: 1_800_000_000_000, maxAttempts: 2,
    }
    const first = await askSurf(options)
    const second = await askSurf(options)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.usage).toMatchObject({ creditsUsed: 50, creditsSource: 'provider', cacheHit: false, totalTokens: 30 })
    expect(second.usage).toMatchObject({ creditsUsed: 0, creditsSource: 'cache', cacheHit: true })
    expect(second.text).toBe(first.text)
  })

  it('uses the published fixed credit rate when Surf omits meta.credits_used', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      status: 'completed', model: 'surf-2.0', output_text: 'Evidence-backed report',
      usage: { input_tokens: 12, output_tokens: 18, total_tokens: 30 },
    }), { status: 200 }))
    const result = await askSurf({
      cacheIdentity: 'missing-credit-metadata', input: 'sample', instructions: 'system',
      apiKey: 'test-key', baseUrl: 'http://127.0.0.1:9999', fetcher: fetcher as typeof fetch,
      effort: 'none', now: 1_800_000_000_000,
    })
    expect(result.usage).toMatchObject({
      creditsUsed: 20, creditsSource: 'published-rate', cacheHit: false, totalTokens: 30,
    })
  })

  it('does not retry an ambiguous timeout by default', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('timed out'))
    await expect(askSurf({
      cacheIdentity: 'timeout-unit', input: 'sample', instructions: 'system',
      apiKey: 'test-key', baseUrl: 'http://127.0.0.1:9999', fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('Surf request failed or timed out')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stores completed results encrypted and reuses them after a process-style module reload', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kolosseum-surf-cache-'))
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        status: 'completed', model: 'surf-2.0', output_text: 'Private captured result',
        meta: { credits_used: 50 },
      }), { status: 200 }))
      const options = {
        cacheIdentity: 'disk-cache-unit', input: 'sample', instructions: 'system',
        apiKey: 'test-key', baseUrl: 'http://127.0.0.1:9999', fetcher: fetcher as typeof fetch,
        now: 1_800_000_000_000, cacheDir: directory, encryptionKey: 'ab'.repeat(32),
      }
      await askSurf(options)
      const files = await readdir(directory)
      expect(files).toHaveLength(1)
      expect(await readFile(join(directory, files[0]), 'utf8')).not.toContain('Private captured result')
      vi.resetModules()
      const { askSurf: afterRestart } = await import('./surfClient')
      const replay = await afterRestart(options)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(replay).toMatchObject({ text: 'Private captured result', usage: { cacheHit: true, creditsUsed: 0 } })
    } finally {
      if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe cache cleanup path')
      await rm(directory, { recursive: true, force: true })
    }
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
