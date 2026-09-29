import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { Keypair, Transaction } from '@solana/web3.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { encryptReport, sha256 } from '../evidence/reportCrypto'
config({ path: '.env.local', quiet: true })
const url = process.env.TEST_DATABASE_URL, originalUrl = process.env.DATABASE_URL
if (url) { const test = new URL(url), app = originalUrl ? new URL(originalUrl) : null; if (test.pathname !== '/kolosseum_test' || (test.host === app?.host && test.pathname === app.pathname)) throw new Error('Use a separate kolosseum_test database') }
const mocks = vi.hoisted(() => ({ rpc: {} as Record<string, unknown>, owner: '', operator: undefined as unknown, context: {} as Record<string, unknown> }))
const surf = vi.hoisted(() => vi.fn())
vi.mock('./surfClient', () => ({ askSurf: surf }))
vi.mock('../payments/reportNft', async original => ({ ...await original<typeof import('../payments/reportNft')>(), devnet: async () => mocks.rpc }))
vi.mock('./kolContext', () => ({ loadKolContext: async () => mocks.context }))
vi.mock('./liveChain', async original => ({ ...await original<typeof import('./liveChain')>(), liveOperator: async () => mocks.operator, assetState: async () => ({ owner: mocks.owner, transfersAllowed: true }) }))
vi.mock('../payments/solPricing', async original => ({ ...await original<typeof import('../payments/solPricing')>(), fetchSolRate: async () => ({ usdMicros: 150_000_000, asOf: new Date().toISOString(), source: 'test' }) }))
let db: typeof import('./db'), service: typeof import('./liveService')
const buyer = Keypair.generate(), stranger = Keypair.generate(), holder = Keypair.generate(), operator = Keypair.generate()
const statuses = vi.fn(), broadcast = vi.fn(); let id = ''
describe.skipIf(!url)('live report ledger and dynamic access (isolated DB, mocked RPC)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url; process.env.SURF_API_KEY ||= 'test-only'; process.env.REPORT_ENC_KEY ||= 'bc'.repeat(32)
    mocks.operator = operator; mocks.rpc = { rpcEndpoint: 'https://api.devnet.solana.com', getLatestBlockhash: async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 1000 }), getFeeForMessage: async () => ({ value: 5000 }), getSignatureStatuses: statuses, getBlockHeight: async () => 100, sendRawTransaction: broadcast }
    mocks.context = { actor: { handle: 'helenvn88', displayName: 'Test KOL' }, posts: [{ url: 'https://x.com/helenvn88/status/123', text: 'source' }], source: { scexAsOf: '2026-09-20' } }
    db = await import('./db'); service = await import('./liveService')
    await db.getPool().query(readFileSync(new URL('../../dr_migrations/0003_live_research.sql', import.meta.url), 'utf8'))
    statuses.mockResolvedValue({ value: [null] }); broadcast.mockRejectedValue(new Error('ambiguous'))
  }, 60000)
  afterAll(async () => {
    if (db) { await db.getPool().query('DELETE FROM dr_live_operations WHERE job_id IN (SELECT id FROM dr_live_jobs WHERE author_wallet=$1)', [buyer.publicKey.toBase58()]); await db.getPool().query('DELETE FROM dr_live_events WHERE job_id IN (SELECT id FROM dr_live_jobs WHERE author_wallet=$1)', [buyer.publicKey.toBase58()]); await db.getPool().query('DELETE FROM dr_live_jobs WHERE author_wallet=$1', [buyer.publicKey.toBase58()]); await db.getPool().end() }
    if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl
  }, 30000)
  it('reuses concurrent quotes, persists signatures before broadcast and queues only finalized payments', async () => {
    const address = buyer.publicKey.toBase58(), input = { handle: 'helenvn88', effort: 'xhigh', policy: { view: 'holders', viewers: [], allowTransfers: false } }
    const quotes = await Promise.all([service.quoteLive(address, input), service.quoteLive(address, input)])
    expect(quotes[0].id).toBe(quotes[1].id); id = quotes[0].id
    expect(quotes[0].quote.lamports).toBe('8000000')
    const tx = Transaction.from(Buffer.from(quotes[0].transaction!, 'base64')); tx.sign(buyer); const signed = tx.serialize().toString('base64')
    await expect(service.submitLivePayment(id, stranger.publicKey.toBase58(), signed)).rejects.toThrow('Only the report author')
    expect((await service.submitLivePayment(id, address, signed)).status).toBe('payment_pending')
    expect((await service.liveRow(id)).signed_payment).toBe(signed)
    await service.submitLivePayment(id, address, signed); expect(broadcast.mock.calls[0][0]).toEqual(broadcast.mock.calls[1][0])
    statuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'confirmed' }] }); await service.reconcileLivePayment(id); expect((await service.liveRow(id)).status).toBe('payment_pending')
    statuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'finalized' }] }); await service.reconcileLivePayment(id); expect((await service.liveRow(id)).status).toBe('queued')
  }, 30000)
  it('keeps content encrypted and gates access against current NFT ownership and author policy', async () => {
    const content = 'Private live report ' + randomUUID(), author = buyer.publicKey.toBase58(), owner = holder.publicKey.toBase58()
    await db.getPool().query("UPDATE dr_live_jobs SET status='ready',result_encrypted=$2,content_hash=$3,asset=$4 WHERE id=$1", [id, encryptReport(JSON.stringify({ content }), process.env.REPORT_ENC_KEY!), sha256(content), Keypair.generate().publicKey.toBase58()])
    expect((await service.liveRow(id)).result_encrypted).not.toContain(content)
    mocks.owner = owner; expect((await service.liveView(id, owner)).content).toBe(content)
    mocks.owner = stranger.publicKey.toBase58(); await expect(service.liveView(id, owner)).rejects.toThrow('access denied')
    expect((await service.liveView(id, author)).content).toBe(content)
    await expect(service.updateLiveViewing(id, owner, { view: 'public', viewers: [], allowTransfers: true })).rejects.toThrow('Only the report author')
    await service.updateLiveViewing(id, author, { view: 'author', viewers: [], allowTransfers: true })
    expect((await service.liveView(id, mocks.owner)).content).toBeUndefined()
    expect((await service.liveRow(id)).policy.allowTransfers).toBe(false)
    await service.updateLiveViewing(id, author, { view: 'public', viewers: [], allowTransfers: false })
    expect((await service.liveView(id, null)).content).toBe(content)
    expect(JSON.stringify(await service.liveMetadata(id))).not.toContain(content)
    await service.updateLiveViewing(id, author, { view: 'allowlist', viewers: [owner], allowTransfers: false })
    expect((await service.liveView(id, owner)).content).toBe(content)
    await service.updateLiveViewing(id, author, { view: 'author', viewers: [], allowTransfers: false })
    await expect(service.liveView(id, owner)).rejects.toThrow('access denied')
  }, 30000)
  it('returns the same refund transaction after an ambiguous broadcast and refunds once', async () => {
    const address = buyer.publicKey.toBase58(); await db.getPool().query("UPDATE dr_live_jobs SET status='failed',asset=NULL WHERE id=$1", [id])
    // Finalized original payment; refund has no status yet.
    const original = (await service.liveRow(id)).payment_signature
    statuses.mockImplementation(async ([signature]: string[]) => ({ value: [signature === original ? { err: null, confirmationStatus: 'finalized' } : null] }))
    const a = await service.prepareLiveOperation(id, address, 'refund'), b = await service.prepareLiveOperation(id, address, 'refund')
    expect(a.id).toBe(b.id); expect(a.status).toBe('submitted'); expect(a.signature).toBe(b.signature)
    statuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'finalized' }] })
    expect((await service.reconcileLiveOperation(a.id, address)).status).toBe('confirmed')
    expect((await service.liveRow(id)).status).toBe('refunded')
    await expect(service.prepareLiveOperation(id, address, 'refund')).rejects.toThrow('not ready')
  }, 30000)
  it('runs a paid job once, validates/encrypts its result and never retries failed paid calls', async () => {
    const { runLiveWorkerOnce, LIVE_SECTIONS } = await import('./liveWorker')
    const address = buyer.publicKey.toBase58(), input = { handle: 'helenvn88', effort: 'low', policy: { view: 'author', viewers: [], allowTransfers: false } }
    const quote = await service.quoteLive(address, input)
    await runLiveWorkerOnce(); expect(surf).not.toHaveBeenCalled()
    await db.getPool().query("UPDATE dr_live_jobs SET status='queued' WHERE id=$1", [quote.id])
    const text = LIVE_SECTIONS.map(s => '## ' + s + '\n\nEvidence.').join('\n\n') + '\nhttps://x.com/helenvn88/status/123'
    surf.mockResolvedValue({ text, usage: {}, model: 'test' })
    await Promise.all([runLiveWorkerOnce(), runLiveWorkerOnce()])
    expect(surf).toHaveBeenCalledTimes(1)
    expect(surf.mock.calls[0][0]).toMatchObject({ maxAttempts: 1, timeoutMs: 1800000, stream: true, effort: 'low' })
    expect((await service.liveView(quote.id, address)).content).toContain('Evidence.')
    expect((await service.liveRow(quote.id)).result_encrypted).not.toContain('Evidence.')
    const next = await service.quoteLive(address, input)
    await db.getPool().query("UPDATE dr_live_jobs SET status='queued' WHERE id=$1", [next.id])
    surf.mockRejectedValue(new Error('Ambiguous upstream timeout'))
    await runLiveWorkerOnce(); await runLiveWorkerOnce()
    expect(surf).toHaveBeenCalledTimes(2)
    expect((await service.liveRow(next.id)).status).toBe('failed')
    const capped = await service.quoteLive(address, input)
    await db.getPool().query("UPDATE dr_live_jobs SET status='queued' WHERE id=$1", [capped.id])
    vi.stubEnv('SURF_LIVE_DAILY_CREDIT_CAP', '0')
    try { await runLiveWorkerOnce(); expect(surf).toHaveBeenCalledTimes(2); expect((await service.liveRow(capped.id)).error_code).toContain('capacity reached') }
    finally { vi.unstubAllEnvs() }
  }, 30000)
})
