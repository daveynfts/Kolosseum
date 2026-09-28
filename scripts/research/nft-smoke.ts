import assert from 'node:assert/strict'
import { createPrivateKey, sign } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { Keypair } from '@solana/web3.js'
import { buildNftTransaction, type NftQuote, type PremiumReport } from '../../lib/payments/reportNft'
import { sha256 } from '../../lib/evidence/reportCrypto'
const base = process.env.NFT_SMOKE_URL || 'http://127.0.0.1:5175'
const buyer = Keypair.generate(), recipient = Keypair.generate().publicKey.toBase58()
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(buyer.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' })
const report: PremiumReport = { version: 1, handle: 'luong4101992', displayName: 'nbaluong', model: 'surf-2.0', effort: 'xhigh', credits: 200, creditsSource: 'published-rate', creditUsdMicros: 6000, content: '## Summary\n\nSynthetic browser test report.\n\n## Sources\n\nTest only.', contentHash: '', createdAt: new Date().toISOString(), snapshotAt: '2026-09-20', sampledPosts: 36, sources: [] }
report.contentHash = sha256(report.content)
const id = '00000000-0000-4000-8000-000000000001'
const built = buildNftTransaction({ buyer: buyer.publicKey.toBase58(), recipient, uri: 'https://example.com/nft.json', id, contentHash: report.contentHash, handle: report.handle, lamports: '8000000', blockhash: Keypair.generate().publicKey.toBase58(), rpc: 'https://api.devnet.solana.com' })
const quote: NftQuote = { id, buyer: buyer.publicKey.toBase58(), recipient, asset: built.asset, contentHash: report.contentHash, credits: 200, usdMicros: 1200000, solUsdMicros: 150000000, rateAsOf: new Date().toISOString(), rateSource: 'Synthetic test rate', lamports: '8000000', networkFeeLamports: 10000, mintCostEstimateLamports: 10000000, blockhash: built.tx.recentBlockhash!, lastValidBlockHeight: 100000, expiresAt: new Date(Date.now() + 120000).toISOString(), metadataUri: 'https://example.com/nft.json', network: 'devnet' }
let submitted = 0, polls = 0, signRequests = 0, denyPayment = true, expired = false, corrupt = false, confirmed = false
const output = join(tmpdir(), 'kolosseum-nft-review'); await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.exposeFunction('nftTestSign', (bytes: number[]) => [...sign(null, Buffer.from(bytes), privateKey)])
  await context.exposeFunction('nftTestSignTransaction', (bytes: number[]) => { signRequests++; if (denyPayment) throw new Error('User rejected payment'); return [...sign(null, Buffer.from(bytes), privateKey)] })
  const walletBootstrap = ({ bytes }: { bytes: number[] }) => {
    const events = new Map<string, Set<(...args: unknown[]) => void>>()
    const key = () => ({ toBytes: () => Uint8Array.from(bytes) })
    const provider = { isPhantom: true, isConnected: false, publicKey: null as ReturnType<typeof key> | null,
      on(n: string, cb: (...args: unknown[]) => void) { if (!events.has(n)) events.set(n, new Set()); events.get(n)!.add(cb) },
      off(n: string, cb: (...args: unknown[]) => void) { events.get(n)?.delete(cb) },
      async connect() { this.publicKey = key(); this.isConnected = true; return { publicKey: this.publicKey } },
      async disconnect() { this.publicKey = null; this.isConnected = false; for (const cb of events.get('disconnect') || []) cb() },
      // Test-only provider. It cannot access any personal wallet.
      async signMessage(message: Uint8Array) { return { signature: Uint8Array.from(await (window as any).nftTestSign([...message])) } },
      async signTransaction(tx: any) { tx.addSignature(tx.feePayer, Uint8Array.from(await (window as any).nftTestSignTransaction([...tx.serializeMessage()]))); return tx },
    }
    ;(window as any).phantom = { solana: provider }; (window as any).isPhantomInstalled = true
  }
  await context.addInitScript({ content: `window.__name = value => value; (${walletBootstrap.toString()})(${JSON.stringify({ bytes: [...buyer.publicKey.toBytes()] })})` })
  const response = (status: string) => ({ id, quote: { ...quote, expiresAt: expired ? new Date(Date.now() - 1000).toISOString() : quote.expiresAt }, status, signature: status === 'quoted' ? null : 'test-signature', transaction: status === 'quoted' ? built.tx.serialize({ requireAllSignatures: false }).toString('base64') : undefined, report: status === 'confirmed' ? { ...report, ...(corrupt ? { content: 'Tampered report' } : {}) } : undefined })
  await context.route('**/dr-api/nft/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path.endsWith('/catalog')) data = { ...report, storageConfigured: true }
    else if (path.endsWith('/quotes')) data = response(confirmed ? 'confirmed' : 'quoted')
    else if (path.endsWith('/submit')) { submitted++; data = response('submitted') }
    else if (path.endsWith('/purchases')) data = { purchases: submitted ? [response('confirmed')] : [] }
    else { polls++; if (polls >= 2) confirmed = true; data = response(confirmed ? 'confirmed' : 'submitted') }
    await route.fulfill({ json: data })
  })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(base + '/scex?kol=luong4101992&tab=surfai')
  const checkout = page.locator('.nft-checkout')
  await checkout.getByRole('heading', { name: 'Research worth collecting.' }).waitFor()
  await checkout.getByRole('button', { name: 'Connect wallet', exact: true }).click()
  await page.getByRole('dialog', { name: 'Connect your wallet' }).getByRole('button', { name: /Phantom/ }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: join(output, 'connected-debug.png') })
  await checkout.getByRole('button', { name: 'Get SOL quote' }).click()
  await checkout.getByRole('heading', { name: 'Review your payment' }).waitFor()
  assert.equal(signRequests, 0, 'quote never requests payment automatically')
  const pay = checkout.getByRole('button', { name: /Pay .* SOL \+ fees/ })
  await pay.click(); await checkout.getByRole('alert').filter({ hasText: 'rejected payment' }).waitFor()
  assert.equal(submitted, 0, 'rejected wallet payment is never submitted')
  for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); await page.screenshot({ path: join(output, `checkout-${width}.png`) }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false) }
  expired = true; await checkout.getByRole('button', { name: 'Refresh quote' }).click(); await page.waitForTimeout(1000); assert.equal(await pay.isDisabled(), true)
  expired = false; quote.expiresAt = new Date(Date.now() + 120000).toISOString(); await checkout.getByRole('button', { name: 'Refresh quote' }).click(); await page.waitForTimeout(300)
  denyPayment = false; await pay.click()
  await checkout.getByText('Confirming payment and NFT on Solana Devnet…', { exact: true }).waitFor()
  await checkout.getByRole('heading', { name: 'Your SurfAI report NFT' }).waitFor({ timeout: 20000 })
  assert.equal(submitted, 1); assert(polls >= 2, 'automatic confirmation polling works despite countdown rerenders')
  await page.screenshot({ path: join(output, 'confirmed.png') })
  await page.reload(); await checkout.getByRole('button', { name: 'Recover my purchase' }).click(); await checkout.getByRole('heading', { name: 'Your SurfAI report NFT' }).waitFor()
  assert.equal(submitted, 1, 'reload recovery never creates another payment')
  corrupt = true; await page.reload(); await checkout.getByRole('button', { name: 'Recover my purchase' }).click(); await checkout.getByRole('alert').filter({ hasText: 'integrity' }).waitFor(); assert.equal(await checkout.getByRole('heading', { name: 'Your SurfAI report NFT' }).count(), 0)
  corrupt = false; await page.goto(base + '/me'); await page.getByRole('button', { name: 'Load my NFTs' }).click(); await page.getByRole('button', { name: 'Open purchase' }).click(); await page.getByRole('heading', { name: 'Your SurfAI report NFT' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: wallet quote, rejected payment, expiry, signature, one submission, automatic confirmation, reload recovery, library, tampered report, 390/768/1440px. Mock API; no transaction broadcast.')
} finally { await browser.close() }
