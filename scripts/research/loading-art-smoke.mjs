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
  await page.locator('.arena-slideshow__image.is-ready').waitFor({ timeout: 30000 })

  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now()+200));
  const title=page.locator('.arena-slideshow__title h4');
  const first=await title.textContent();
  await page.getByRole('button',{name:'Pause slideshow'}).click();
  await page.clock.runFor(1100);
  assert.equal(await title.textContent(),first);
  await page.getByRole('button',{name:'Resume slideshow'}).click();
  await page.clock.runFor(5100);
  assert.notEqual(await title.textContent(),first,'automatic slide advance');
  await page.getByRole('button',{name:'Pause slideshow'}).click();
  const seen=new Set();
  for(let i=0;i<10;i++){
    await page.locator('.arena-slideshow__image.is-ready').waitFor();
    const current=await title.textContent();seen.add(current);
    assert(await page.locator('.arena-slideshow__fact p').textContent());
    assert((await page.locator('.arena-slideshow__footer a').getAttribute('href')).startsWith('https://'));
    await page.getByRole('button',{name:'Next arena'}).click();
    await page.getByRole('heading',{name:current,exact:true}).waitFor({state:'detached'});
  }
  assert.equal(seen.size,10,'all ten artworks and facts are reachable');
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.locator('.scex-detail__scroll').evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:join(output,'tour-'+width+'.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.arena-slideshow__image').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(sceneRequests.length,0);assert.deepEqual(errors,[]);
  console.log('PASS: automatic slide advance, pause, all 10 images/facts, responsive views and reduced motion.');
} finally {await browser.close()}