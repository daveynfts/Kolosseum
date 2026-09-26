import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Browser smoke uses the real wallet adapter against a controlled test provider.
// It does not approve or access a user's real wallet.
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-extensions', '--disable-background-networking', '--no-first-run', '--enable-unsafe-swiftshader'] })
const output = join(tmpdir(), 'kolosseum-premium-review')
await mkdir(output, { recursive: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    const events = new Map()
    const key = value => ({ toBytes: () => new Uint8Array(32).fill(value) })
    const provider = {
      isPhantom: true, isConnected: false, publicKey: null, rejectNext: false,
      on(name, fn) { const list = events.get(name) || []; list.push(fn); events.set(name, list) },
      off(name, fn) { events.set(name, (events.get(name) || []).filter(f => f !== fn)) },
      emit(name, value) { for (const fn of events.get(name) || []) fn(value) },
      async connect() { if (this.rejectNext) { this.rejectNext = false; throw new Error('User rejected the request.') } this.publicKey = key(1); this.isConnected = true; return { publicKey: this.publicKey } },
      async disconnect() { this.isConnected = false; this.publicKey = null; this.emit('disconnect') },
      changeAccount() { this.publicKey = key(2); this.emit('accountChanged', this.publicKey) },
      async signMessage() { throw new Error('Demo must not request a signature') },
      async signTransaction() { throw new Error('Demo must not request a transaction') },
    }
    window.isPhantomInstalled = true
    window.phantom = { solana: provider }
  })
  const page = await context.newPage()
  const errors = [], forbidden = [], sceneRequests = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', request => { if (/ColosseumScene/.test(request.url())) sceneRequests.push(request.url()); if (/\/dr-api\//.test(request.url()) || /api\.devnet\.solana\.com/.test(request.url())) forbidden.push(request.url()) })
  await page.goto('http://127.0.0.1:5173/scex', { waitUntil: 'domcontentloaded' })
  await page.locator('.premium-featured').waitFor({ timeout: 30000 })
  await page.screenshot({ path: join(output, 'arena-desktop.png') })
  assert.equal(sceneRequests.length, 0, '3D scene must not load in the initial Arena')
  await page.locator('.premium-featured').click()
  await page.getByRole('tab', { name: 'SurfAI' }).click()
  await page.locator('.surf-connect').waitFor()
  await page.locator('.surf-connect').getByRole('button', { name: 'Connect wallet' }).click()
  await page.evaluate(() => { window.phantom.solana.rejectNext = true })
  await page.getByRole('dialog', { name: 'Connect your wallet' }).getByRole('button', { name: /Phantom/ }).click()
  await page.getByRole('alert').filter({ hasText: 'rejected' }).waitFor()
  await page.getByRole('dialog', { name: 'Connect your wallet' }).getByRole('button', { name: /Phantom/ }).click()
  await page.locator('.surf-loading').waitFor()
  await page.locator('.colosseum-canvas canvas').waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(output, 'duel-desktop.png') })
  if (process.argv.includes('--capture-poster')) await page.locator('.colosseum-canvas canvas').screenshot({ path: 'public/demo/arena-poster.jpg', type: 'jpeg', quality: 90 })
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByRole('button', { name: 'Resume animation' }).click()
  const before = await page.getByRole('progressbar').getAttribute('aria-valuenow')
  await page.evaluate(() => window.phantom.solana.disconnect())
  await page.locator('.surf-connect').waitFor()
  await page.waitForTimeout(800)
  await page.locator('.surf-connect').getByRole('button', { name: 'Connect wallet' }).click()
  await page.getByRole('dialog', { name: 'Connect your wallet' }).getByRole('button', { name: /Phantom/ }).click()
  await page.locator('.surf-loading').waitFor()
  const resumed = await page.getByRole('progressbar').getAttribute('aria-valuenow')
  assert(Number(resumed) >= Number(before), 'progress resumes after reconnect')
  await page.evaluate(() => window.phantom.solana.changeAccount())
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor({ timeout: 20000 })
  assert.equal(await page.locator('.premium-report__section').count(), 8)
  await page.screenshot({ path: join(output, 'report-desktop.png') })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor({ timeout: 30000 })
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.screenshot({ path: join(output, 'report-' + width + '.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no document overflow')
    const box = await page.getByRole('dialog', { name: /Details for/ }).boundingBox()
    assert(box.x >= 0 && box.x + box.width <= width + 1, 'profile stays within viewport')
  }
  await page.getByRole('button', { name: 'Replay experience' }).click()
  await page.locator('.colosseum-canvas canvas').waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(output, 'duel-mobile.png') })
  await page.getByRole('button', { name: 'Show report now' }).click()
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor()
  await page.goto('http://127.0.0.1:5173/me', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Read report' }).waitFor()
  await page.screenshot({ path: join(output, 'my-reports-mobile.png') })

  await page.goto('http://127.0.0.1:5173/scex?kol=luong4101992&tab=surfai')
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor()
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await page.goBack()
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor()
  await page.goForward()
  assert.equal(await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('tab', { name: /SurfAI/ }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Replay experience' }).click()
  await page.locator('.arena-poster img').waitFor()
  assert.equal(await page.locator('canvas').count(), 0, 'reduced motion renders no 3D canvas')
  await page.getByRole('button', { name: 'Show report now' }).click()
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Replay experience' }).click()
  await page.locator('.colosseum-canvas canvas').waitFor()
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const canvas = document.querySelector('.colosseum-canvas canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error('Expected a WebGL context')
    gl.getExtension('WEBGL_lose_context').loseContext()
  })
  await page.locator('.arena-poster img').waitFor()
  await page.getByRole('button', { name: 'Show report now' }).click()
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0, 'Escape closes profile')
  await page.route('**/demo/nbaluong.json', route => route.fulfill({ contentType: 'application/json', body: '{"content":"invalid"}' }))
  await page.goto('http://127.0.0.1:5173/scex?kol=luong4101992&tab=surfai')
  await page.getByRole('heading', { name: "We couldn't open the report" }).waitFor()
  await page.unroute('**/demo/nbaluong.json')
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByRole('heading', { name: 'The nbaluong report' }).waitFor()
  const noWallet = await browser.newContext()
  const missing = await noWallet.newPage()
  await missing.goto('http://127.0.0.1:5173/scex?kol=luong4101992&tab=surfai')
  await missing.locator('.surf-connect').getByRole('button', { name: 'Connect wallet' }).click()
  await missing.getByRole('dialog', { name: 'Connect your wallet' }).getByRole('button', { name: /Phantom/ }).click()
  await missing.getByRole('alert').filter({ hasText: 'Install Phantom' }).waitFor()
  await missing.keyboard.press('Escape')
  assert.equal(await missing.getByRole('dialog').count(), 1, 'Escape dismisses only wallet picker')
  assert.equal(await missing.evaluate(() => document.activeElement?.textContent), 'Connect wallet', 'focus returns to wallet trigger')
  await noWallet.close()
  assert.deepEqual(forbidden, [], 'demo must not call research, payment, or Solana APIs')
  assert.deepEqual(errors, [], 'no uncaught browser errors')
  console.log(JSON.stringify({ result: 'PASS', scenarios: ['rejected connect', 'connect', 'pause/resume', 'disconnect/reconnect', 'account switch', 'automatic completion', 'verified 8-section report', 'refresh persistence', '768px', '390px', 'skip', 'viewed demos', 'no research/payment requests', 'lazy scene', 'Back/Forward', 'reduced motion', 'WebGL context loss', 'invalid fixture recovery', 'missing extension', 'Escape and focus restoration'], screenshots: output }, null, 2))
} finally { await browser.close() }
