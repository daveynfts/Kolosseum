import { createHash, createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { decryptReport, hashesMatch, sha256 } from '../evidence/reportCrypto'

export type DemoCapture = {
  version: 1
  signature: string
  recordedAt: string
  status: 'source-ready' | 'report-ready' | 'purchase-verified'
  limitation: string | null
  steps: Array<{ name: string; status: 'verified' | 'pending' | 'blocked'; detail: string }>
  source: { asOf: string; updatedAt: string | null; actorCount: number; postCount: number; topKolPostCount: number }
  kol: {
    handle: string
    displayName: string
    followers: number
    qualityScore: number
    postsVolume: number
    matrix: { x: number; y: number }
  }
  posts: Array<{ id: string; url: string; text: string; postedAt: string }>
  template: { slug: string; title: string; description: string; priceUsdc: string }
  report: null | {
    id: string
    contentEncrypted: string
    contentHash: string
    promptHash: string
    surfModel: string
    surfUsage: { creditsUsed: number | null; cacheHit: boolean }
    createdAt: string
    contextAsOf: string | null
  }
  payment: null | {
    protocol: 'mpp-session' | 'x402-upto'
    buyerWallet: string
    paymentRef: string
    priceChargedUsdc: string
    channel: null | { id: string; capUsdc: string; spentUsdc: string; remainingUsdc: string; status: string }
  }
  verification: null | {
    hashMatch: boolean
    onChainMatch: boolean | null
    evidenceTx: string | null
    explorerUrl: string | null
    votes: { up: number; down: number; supportUsdc: string; challengeUsdc: string }
  }
}

export function signDemoCapture(capture: DemoCapture, encryptionKey: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) throw new Error('REPORT_ENC_KEY must be 32 bytes of hex')
  const macKey = createHash('sha256')
    .update('kolosseum-demo-capture-v1')
    .update(Buffer.from(encryptionKey, 'hex'))
    .digest()
  return createHmac('sha256', macKey)
    .update(JSON.stringify({ ...capture, signature: undefined }))
    .digest('hex')
}

export async function openDemoCapture(path: string, encryptionKey: string): Promise<{
  capture: DemoCapture
  content: string | null
}> {
  const capture = JSON.parse(await readFile(resolve(path), 'utf8')) as DemoCapture
  if (capture.version !== 1 || !capture.kol?.handle || !capture.source?.asOf || !capture.template?.slug) {
    throw new Error('Invalid demo capture')
  }
  if (!hashesMatch(signDemoCapture(capture, encryptionKey), capture.signature)) {
    throw new Error('Demo capture signature mismatch')
  }
  if (!capture.report) return { capture, content: null }
  const content = decryptReport(capture.report.contentEncrypted, encryptionKey)
  if (!hashesMatch(sha256(content), capture.report.contentHash)) {
    throw new Error('Demo capture report hash mismatch')
  }
  return { capture, content }
}
