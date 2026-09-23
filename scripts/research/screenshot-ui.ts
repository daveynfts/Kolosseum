import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--disable-extensions', '--disable-background-networking', '--no-first-run'],
  timeout: 30_000,
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const url = process.argv[2] || 'http://127.0.0.1:5173/scex'
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(4_000)
  if (process.argv[3] === 'detail') {
    await page.locator('.scex-feed-card__author').first().click()
    await page.getByRole('tab', { name: 'Deep Research' }).click()
    await page.waitForTimeout(800)
    process.stdout.write(`Panel: ${await page.locator('.dr-panel').count()} · ${(await page.locator('.dr-panel').innerText()).slice(0, 220).replace(/\n/g, ' ')}\n`)
  }
  const path = join(tmpdir(), process.argv[3] === 'detail' ? 'kolosseum-research-preview.jpg' : 'kolosseum-arena-preview.jpg')
  await page.screenshot({ path, type: 'jpeg', quality: 55, fullPage: false })
  process.stdout.write(`Screenshot: ${path}\n`)
  process.stdout.write(`Title: ${await page.title()}\n`)
} finally {
  await browser.close()
}
