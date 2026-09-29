import { generateKeyPairSync, sign } from 'node:crypto'
import { Keypair, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { canReadLive, liveEffort, livePolicy } from './livePolicy'
import { liveAssetTransaction, paymentTransaction } from './liveChain'
import { liveAccessMessage } from '../payments/reportAccessMessage'
import { verifyDashboardAccess, verifyLiveAccess } from '../payments/walletAccess'
import { assertSignedQuote } from '../payments/reportNft'
import { validateLiveContent, LIVE_SECTIONS } from './liveWorker'
import type { KolContext } from './kolContext'

describe('live report permissions and signed transactions', () => {
  const author = Keypair.generate(), holder = Keypair.generate(), stranger = Keypair.generate()
  it('grants holder access to the current owner, not previous owners or purchase history', () => {
    const policy = livePolicy({ view: 'holders', viewers: [], allowTransfers: true })
    expect(canReadLive(author.publicKey.toBase58(), holder.publicKey.toBase58(), policy, holder.publicKey.toBase58())).toBe(true)
    expect(canReadLive(author.publicKey.toBase58(), holder.publicKey.toBase58(), policy, stranger.publicKey.toBase58())).toBe(false)
    expect(canReadLive(author.publicKey.toBase58(), author.publicKey.toBase58(), policy, stranger.publicKey.toBase58())).toBe(true)
    expect(canReadLive(author.publicKey.toBase58(), null, policy, null)).toBe(false)
  })
  it('enforces public, author-only and allowlist policies and validates inputs', () => {
    const a = author.publicKey.toBase58(), h = holder.publicKey.toBase58()
    expect(canReadLive(a, null, { view: 'public', viewers: [], allowTransfers: false }, null)).toBe(true)
    expect(canReadLive(a, h, { view: 'author', viewers: [], allowTransfers: true }, h)).toBe(false)
    expect(canReadLive(a, h, { view: 'allowlist', viewers: [h], allowTransfers: false }, null)).toBe(true)
    expect(() => livePolicy({ view: 'allowlist', viewers: ['bad'], allowTransfers: true })).toThrow()
    expect(() => liveEffort('__proto__')).toThrow()
  })
  it('uses a separate 45-minute signed session, with no cross-scope reuse', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519'), wallet = bs58.encode(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)), now = Date.now(), issued = new Date(now).toISOString()
    const headers = { 'x-kolosseum-wallet': wallet, 'x-kolosseum-issued-at': issued, 'x-kolosseum-signature': bs58.encode(sign(null, Buffer.from(liveAccessMessage(wallet, issued)), privateKey)) }
    expect(verifyLiveAccess(headers, now + 30 * 60_000)).toBe(wallet)
    expect(verifyLiveAccess(headers, now + 45 * 60_000 + 1)).toBeNull()
    expect(verifyLiveAccess(headers, now - 5 * 60_000)).toBeNull()
    expect(verifyDashboardAccess(headers, now)).toBeNull()
  })
  it('binds payment to its exact quote and mints with an author-controlled permanent freeze plugin', () => {
    const wallet = author.publicKey.toBase58(), blockhash = Keypair.generate().publicKey.toBase58()
    const tx = paymentTransaction(wallet, holder.publicKey.toBase58(), '8000000', blockhash, 'test')
    const original = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'); tx.sign(author)
    expect(assertSignedQuote(tx.serialize().toString('base64'), original, wallet)).toBeInstanceOf(Transaction)
    const changed = paymentTransaction(wallet, stranger.publicKey.toBase58(), '8000000', blockhash, 'test'); changed.sign(author)
    expect(() => assertSignedQuote(changed.serialize().toString('base64'), original, wallet)).toThrow('does not match')
    const built = liveAssetTransaction({ rpc: 'https://api.devnet.solana.com', wallet, blockhash, id: 'report-test', kind: 'mint', hash: 'a'.repeat(64), author: wallet, handle: 'helenvn88', uri: 'https://example.com/metadata', allowTransfers: false })
    built.tx.partialSign(author); expect(built.tx.verifySignatures()).toBe(true)
    expect(built.tx.serialize().length).toBeLessThan(1232)
  })
  it('rejects reports missing source coverage or required sections', () => {
    const context = { posts: [{ url: 'https://x.com/test/status/123' }] } as KolContext
    const headings = LIVE_SECTIONS.map(s => '## ' + s).join('\n')
    expect(() => validateLiveContent(headings, context)).toThrow('source coverage')
    expect(() => validateLiveContent(context.posts[0].url, context)).toThrow('sections')
    expect(validateLiveContent(headings + '\n' + context.posts[0].url, context)).toContain('## Disclaimer')
  })
})
