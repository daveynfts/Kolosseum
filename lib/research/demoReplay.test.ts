import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encryptReport, sha256 } from '../evidence/reportCrypto'
import { openDemoCapture, signDemoCapture, type DemoCapture } from './demoReplay'

const encryptionKey = 'cd'.repeat(32)
const content = '## Summary\nRecorded real research content.\n'

function capture(): DemoCapture {
  return {
    version: 1,
    signature: '',
    recordedAt: '2026-09-25T00:00:00.000Z',
    status: 'report-ready',
    limitation: 'Private preview only',
    steps: [],
    source: { asOf: '2026-09-20', updatedAt: null, actorCount: 1, postCount: 1, topKolPostCount: 1 },
    kol: { handle: 'example', displayName: 'Example', followers: 1, qualityScore: 50, postsVolume: 1, matrix: { x: 0, y: 0 } },
    posts: [],
    template: { slug: 'exchange-stance', title: 'Exchange stance', description: '', priceUsdc: '0.45' },
    report: {
      id: '00000000-0000-0000-0000-000000000001',
      contentEncrypted: encryptReport(content, encryptionKey),
      contentHash: sha256(content),
      promptHash: sha256('prompt'),
      surfModel: 'surf-2.0',
      surfUsage: { creditsUsed: 20, cacheHit: false },
      createdAt: '2026-09-25T00:00:00.000Z',
      contextAsOf: '2026-09-20T00:00:00.000Z',
    },
    payment: null,
    verification: null,
  }
}

describe('recorded demo', () => {
  it('decrypts only a hash-matching report and refuses a tampered hash', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'kolosseum-replay-'))
    const path = join(folder, 'flow.json')
    try {
      const valid = capture()
      valid.signature = signDemoCapture(valid, encryptionKey)
      await writeFile(path, JSON.stringify(valid))
      expect((await openDemoCapture(path, encryptionKey)).content).toBe(content)
      valid.report!.contentHash = sha256('different content')
      await writeFile(path, JSON.stringify(valid))
      await expect(openDemoCapture(path, encryptionKey)).rejects.toThrow('signature mismatch')
      valid.signature = signDemoCapture(valid, encryptionKey)
      await writeFile(path, JSON.stringify(valid))
      await expect(openDemoCapture(path, encryptionKey)).rejects.toThrow('hash mismatch')
    } finally {
      if (!resolve(folder).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test cleanup path')
      await rm(folder, { recursive: true, force: true })
    }
  })
})
