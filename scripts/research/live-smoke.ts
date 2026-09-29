import assert from 'node:assert/strict'
import { createPrivateKey, sign } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { Keypair } from '@solana/web3.js'
import { liveAssetTransaction, paymentTransaction } from '../../lib/research/liveChain'
import { sha256 } from '../../lib/evidence/reportCrypto'
import type { LiveJobView } from '../../lib/research/liveTypes'

const buyer = Keypair.generate(), treasury = Keypair.generate(), address = buyer.publicKey.toBase58()
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(buyer.secretKey.slice(0, 32))]), format: 'der', type: 'pkcs8' })
const id = '00000000-0000-4000-8000-000000000001', opId = '00000000-0000-4000-8000-000000000002'
const blockhash = Keypair.generate().publicKey.toBase58(), content = '## Summary\n\nSynthetic private report for browser verification.\n\n## Sources\n\nTest source.'
const tx = paymentTransaction(address, treasury.publicKey.toBase58(), '4800000', blockhash, id)
const mint = liveAssetTransaction({ rpc: 'https://api.devnet.solana.com', wallet: address, blockhash, id, kind: 'mint', uri: 'https://example.com/metadata', hash: sha256(content), author: address, handle: 'helenvn88', allowTransfers: false })
let job: LiveJobView = { id, handle: 'helenvn88', author: address, effort: 'medium', credits: 120, status: 'quoted', policy: { view: 'holders', viewers: [], allowTransfers: false }, quote: { lamports: '4800000', usdMicros: 720000, solUsdMicros: 150000000, rateAsOf: new Date().toISOString(), recipient: treasury.publicKey.toBase58(), expiresAt: new Date(Date.now() + 120000).toISOString(), blockhash, lastValidBlockHeight: 1000, networkFeeLamports: 5000 }, signature: null, transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), contentHash: sha256(content), snapshotAt: '2026-09-20', sampledPosts: 12, asset: null, canManage: true, eventCount: 0, generatedCharacters: 0, error: null, createdAt: new Date().toISOString() }
let submitted = 0, signRequests = 0, reject = true, corrupt = false, operationKind = 'mint'
let agentPrepared = 0, agentClaims = 0
const output = join(tmpdir(), 'kolosseum-live-review'); await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.exposeFunction('liveTestSign', (bytes: number[]) => [...sign(null, Buffer.from(bytes), privateKey)])
  await context.exposeFunction('liveTestTransaction', (bytes: number[]) => { signRequests++; if (reject) throw new Error('User rejected payment'); return [...sign(null, Buffer.from(bytes), privateKey)] })
  const bootstrap = ({ bytes }: { bytes: number[] }) => {
    const events = new Map<string, Set<(...args: unknown[]) => void>>()
    const key = () => ({ toBytes: () => Uint8Array.from(bytes) })
    const provider = { isPhantom: true, isConnected: false, publicKey: null as ReturnType<typeof key> | null,
      on(n: string, cb: (...args: unknown[]) => void) { if (!events.has(n)) events.set(n, new Set()); events.get(n)!.add(cb) },
      off(n: string, cb: (...args: unknown[]) => void) { events.get(n)?.delete(cb) },
      async connect() { this.publicKey = key(); this.isConnected = true; return { publicKey: this.publicKey } },
      async disconnect() { this.publicKey = null; this.isConnected = false; for (const cb of events.get('disconnect') || []) cb() },
      async signMessage(message: Uint8Array) { return { signature: Uint8Array.from(await (window as any).liveTestSign([...message])) } },
      async signTransaction(transaction: any) { transaction.addSignature(transaction.feePayer, Uint8Array.from(await (window as any).liveTestTransaction([...transaction.serializeMessage()]))); return transaction },
    }
    ;(window as any).phantom = { solana: provider }; (window as any).isPhantomInstalled = true
  }
  await context.addInitScript({ content: `window.__name = value => value; (${bootstrap.toString()})(${JSON.stringify({ bytes: [...buyer.publicKey.toBytes()] })})` })
  await context.route('**/dr-api/live/**', async route => {
    const path = new URL(route.request().url()).pathname, body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
    let data: unknown = job
    if (path.endsWith('/agent/orders')) { agentPrepared++; data = { id, token:'test-capability', handle:job.handle, gateway:'https://sandbox.example.com',sampledPosts:12 } }
    else if (path.includes('/agent/orders/')) { if(path.endsWith('/receipt')){agentClaims++;assert.equal(body.receipt,'saved-test-receipt')} data = {status:agentClaims?'queued':'accepted',payment:{verified:!!agentClaims,payer:agentClaims?address:null,transaction:agentClaims?'test-settlement':null},report:null} }
    else if (path.endsWith('/catalog')) data = { handle: job.handle, sampledPosts: 12, snapshotAt: job.snapshotAt }
    else if (path.endsWith('/library')) data = { reports: [{ id, kol_handle: job.handle, status: job.status, asset: job.asset }] }
    else if (path.endsWith('/payment')) { submitted++; job = { ...job, status: 'running', transaction: undefined, signature: 'test-payment' }; data = job }
    else if (path.endsWith('/viewing')) { job = { ...job, policy: { ...body.policy, allowTransfers: job.policy.allowTransfers } }; data = job }
    else if (path.endsWith('/operations')) {
      operationKind = body.kind
      const built = operationKind === 'mint' ? mint : liveAssetTransaction({ rpc: 'https://api.devnet.solana.com', wallet: address, blockhash, id, kind: 'transfer_policy', asset: mint.asset, hash: job.contentHash!, author: address, handle: job.handle, allowTransfers: true })
      data = { id: opId, kind: operationKind, jobId: id, status: 'quoted', transaction: built.tx.serialize({ requireAllSignatures: false }).toString('base64') }
    } else if (path.endsWith('/operations/' + opId)) {
      job = { ...job, asset: mint.asset, owner: address, transfersAllowed: operationKind === 'transfer_policy' }
      data = { id: opId, jobId: id, kind: operationKind, status: 'confirmed', signature: 'test-operation' }
    } else if (path.endsWith('/reports/' + id)) {
      if (job.status === 'running') job = { ...job, status: 'ready', content }
      data = corrupt ? { ...job, content: 'Tampered' } : job
    }
    await route.fulfill({ json: data })
  })
  const page = await context.newPage(), errors: string[] = []
  page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000)
  page.on('pageerror', e => errors.push(e.message))
  await page.goto((process.env.LIVE_SMOKE_URL || 'http://127.0.0.1:5173') + '/scex?kol=helenvn88&tab=surfai', {waitUntil:'domcontentloaded'})
  const panel = page.locator('.live-research')
  await panel.getByRole('heading', { name: 'Research @helenvn88' }).waitFor()
  await panel.getByRole('button', { name: 'Connect wallet', exact: true }).click()
  await page.getByRole('dialog', { name: 'Connect your wallet' }).getByRole('button', { name: /Phantom/ }).click()
  const agent = panel.getByRole('region', { name: 'Use with an agent' })
  await agent.getByRole('button', {name:'Prepare agent prompt'}).click()
  await agent.getByRole('button', {name:'Copy agent prompt'}).waitFor()
  const prompt = await agent.getByLabel('Private agent prompt').inputValue()
  assert(prompt.includes('pay --sandbox curl')); assert(prompt.includes('PAYMENT-RESPONSE')); assert(prompt.includes('0.72'))
  assert.equal(agentPrepared,1); assert.equal(signRequests,0,'preparing an agent prompt never signs a payment')
  await agent.getByText('Recover an existing payment',{exact:true}).click()
  await agent.getByLabel('Settlement receipt').fill('saved-test-receipt')
  await agent.getByRole('button',{name:'Verify receipt & continue research'}).click()
  await agent.getByText('Payment verified',{exact:true}).waitFor()
  assert.equal(agentClaims,1);assert.equal(signRequests,0,'receipt recovery never signs another payment')
  assert(prompt.includes('KOLOSSEUM_RECEIPT:%header{payment-response}'))
  await panel.getByRole('button', { name: 'Get SOL quote', exact: true }).click()
  const pay = panel.getByRole('button', { name: /Pay .* SOL & start research/ })
  await pay.waitFor(); assert.equal(signRequests, 0)
  await pay.click(); await panel.getByRole('alert').filter({ hasText: 'rejected' }).waitFor(); assert.equal(submitted, 0)
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.screenshot({ path: join(output, `quote-${width}.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1), false)
  }
  reject = false; await pay.click(); await panel.getByText(/Surf is researching/).waitFor()
  await panel.getByRole('button', { name: 'Mint my report access NFT' }).waitFor({ timeout: 20000 }); assert.equal(submitted, 1)
  await panel.getByLabel('Who can read?').selectOption('author'); await panel.getByRole('button', { name: 'Save viewing permissions' }).click()
  await page.waitForTimeout(300); assert.equal(job.policy.view, 'author')
  await panel.getByRole('button', { name: 'Mint my report access NFT' }).click(); await panel.getByRole('link', { name: 'View report NFT ↗' }).waitFor()
  await panel.getByRole('button', { name: /Allow transfers & resale/ }).click(); await panel.getByRole('button', { name: /Freeze transfers & resale/ }).waitFor()
  await page.screenshot({ path: join(output, 'ready.png') })
  await page.reload({waitUntil:'domcontentloaded'}); await panel.getByRole('button', { name: 'Recover my report' }).click(); await panel.getByRole('link', { name: 'View report NFT ↗' }).waitFor(); assert.equal(submitted, 1)
  corrupt = true; await page.reload(); await panel.getByRole('button', { name: 'Recover my report' }).click(); await panel.getByRole('alert').filter({ hasText: 'integrity' }).waitFor()
  corrupt = false; await page.goto((process.env.LIVE_SMOKE_URL || 'http://127.0.0.1:5173') + '/me?report=' + id)
  await panel.getByRole('button', { name: 'Sign in & load reports' }).click(); await panel.getByRole('link', { name: 'View report NFT ↗' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: live quote, wallet rejection, one payment, polling, author permissions, mint, thaw, recovery, hash rejection, library, 390/768/1440px. Mock wallet/API only; no broadcasts or paid Surf requests.')
} finally { await browser.close() }
