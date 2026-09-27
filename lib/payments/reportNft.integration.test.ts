import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { Connection, Keypair, Transaction } from '@solana/web3.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { sha256 } from '../evidence/reportCrypto'
config({ path: '.env.local', quiet: true })
const testUrl = process.env.TEST_DATABASE_URL, originalUrl = process.env.DATABASE_URL
if (testUrl) {
  const target = new URL(testUrl), application = originalUrl ? new URL(originalUrl) : null
  if (target.pathname !== '/kolosseum_test' || (application?.hostname === target.hostname && application.pathname === target.pathname && application.port === target.port)) throw new Error('NFT integration tests require a separate kolosseum_test database')
}
const fixture = vi.hoisted(() => ({ report: {} as Record<string, unknown>, storage: {} as Record<string, unknown> }))
vi.mock('@solana/web3.js', async original => {
  const actual = await original<typeof import('@solana/web3.js')>()
  class TestConnection extends actual.Connection {
    constructor(...args: ConstructorParameters<typeof actual.Connection>) { super(...args); this.getBlockHeight = async () => 100 }
  }
  return { ...actual, Connection: TestConnection }
})
vi.mock('node:fs/promises', async original => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, readFile: (...args: Parameters<typeof actual.readFile>) => args[0] === 'public/demo/nbaluong-premium.json' ? Promise.resolve(JSON.stringify(fixture.report)) : args[0] === 'public/demo/nft-storage.json' ? Promise.resolve(JSON.stringify(fixture.storage)) : actual.readFile(...args) }
})
let db: typeof import('../research/db'), service: typeof import('./reportNft')
const buyer = Keypair.generate(), stranger = Keypair.generate(), treasury = Keypair.generate().publicKey.toBase58()
const oldTreasury = process.env.REPORT_SOL_TREASURY
const status = vi.fn(), broadcast = vi.fn()
describe.skipIf(!testUrl)('NFT purchase ledger and retry safety (isolated PostgreSQL; mocked RPC)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl; process.env.REPORT_SOL_TREASURY = treasury
    db = await import('../research/db'); service = await import('./reportNft')
    await db.getPool().query(readFileSync(new URL('../../dr_migrations/0002_report_nfts.sql', import.meta.url), 'utf8'))
    const content = 'Synthetic test report ' + randomUUID(), hash = sha256(content)
    fixture.report = { version: 1, handle: 'luong4101992', model: 'surf-2.0', effort: 'xhigh', credits: 200, creditUsdMicros: 6000, content, contentHash: hash }
    const metadata = { properties: { report_hash: hash, report_uri: 'https://test.invalid/report' } }
    fixture.storage = { contentHash: hash, metadataUri: 'https://test.invalid/metadata', reportUri: 'https://test.invalid/report', metadataHash: sha256(JSON.stringify(metadata)) }
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => new Response(JSON.stringify(String(input).includes('coingecko') ? { solana: { usd: 150, last_updated_at: Math.floor(Date.now() / 1000) } } : String(input).endsWith('/metadata') ? metadata : fixture.report))))
    vi.spyOn(Connection.prototype, 'getGenesisHash').mockResolvedValue(service.DEVNET_GENESIS)
    vi.spyOn(Connection.prototype, 'getLatestBlockhash').mockResolvedValue({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 1000 })
    vi.spyOn(Connection.prototype, 'getFeeForMessage').mockResolvedValue({ context: { slot: 1 }, value: 10000 })
    vi.spyOn(Connection.prototype, 'getBalance').mockResolvedValue(1_000_000_000)
    vi.spyOn(Connection.prototype, 'getSignatureStatuses').mockImplementation(status)
    vi.spyOn(Connection.prototype, 'sendRawTransaction').mockImplementation(broadcast)
    status.mockResolvedValue({ value: [null] }); broadcast.mockRejectedValue(new Error('Synthetic ambiguous timeout'))
  }, 60000)
  afterAll(async () => {
    if (db) { await db.getPool().query('DELETE FROM dr_nft_purchases WHERE buyer_wallet = ANY($1)', [[buyer.publicKey.toBase58(), stranger.publicKey.toBase58()]]); await db.getPool().end() }
    if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl
    if (oldTreasury === undefined) delete process.env.REPORT_SOL_TREASURY; else process.env.REPORT_SOL_TREASURY = oldTreasury
    vi.restoreAllMocks(); vi.unstubAllGlobals()
  }, 30000)
  it('reuses concurrent quotes and the original signed transaction after an ambiguous broadcast', async () => {
    const address = buyer.publicKey.toBase58()
    const quotes = await Promise.all([service.createNftQuote(address), service.createNftQuote(address), service.createNftQuote(address)])
    expect(new Set(quotes.map(q => q.quote.asset)).size).toBe(1)
    expect(quotes[0].quote.lamports).toBe('8000000')
    const purchase = quotes[0], tx = Transaction.from(Buffer.from(purchase.transaction!, 'base64')); tx.partialSign(buyer)
    const signed = tx.serialize().toString('base64')
    await expect(service.submitNftPurchase(purchase.id, stranger.publicKey.toBase58(), signed)).rejects.toThrow('not found')
    await db.getPool().query("UPDATE dr_nft_purchases SET quote=jsonb_set(quote,'{expiresAt}',to_jsonb($2::text)) WHERE id=$1", [purchase.id, new Date(Date.now() - 1000).toISOString()])
    await expect(service.submitNftPurchase(purchase.id, address, signed)).rejects.toThrow('expired')
    await db.getPool().query('UPDATE dr_nft_purchases SET quote=$2 WHERE id=$1', [purchase.id, purchase.quote])
    const first = await service.submitNftPurchase(purchase.id, address, signed)
    expect(first.status).toBe('submitted'); expect(first.report).toBeUndefined()
    const second = await service.submitNftPurchase(purchase.id, address, signed)
    expect(second.signature).toBe(first.signature)
    expect(broadcast.mock.calls[0][0]).toEqual(broadcast.mock.calls[1][0])
    expect((await service.createNftQuote(address)).signature).toBe(first.signature)
    status.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'confirmed' }] })
    const confirmed = await service.refreshNftPurchase(purchase.id, address)
    expect(confirmed.status).toBe('confirmed'); expect(confirmed.report?.contentHash).toBe(fixture.report.contentHash)
    expect(await service.listNftPurchases(stranger.publicKey.toBase58())).toHaveLength(0)
    expect(await service.listNftPurchases(address)).toHaveLength(1)
  }, 30000)
})
