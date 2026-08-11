import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'

const outDir = 'C:/Temp/radar-og'
const publicOg = path.join(process.cwd(), 'public/og/scex-radar.jpg')
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(path.dirname(publicOg), { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
})
// Dismiss story tip + any first-run UI
await context.addInitScript(() => {
  try {
    localStorage.setItem('scex-story-tip-v1', '1')
  } catch {}
})
const page = await context.newPage()
await page.goto('https://radar.daveynfts.com/scex', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
for (let i = 0; i < 40; i++) {
  const ok = await page.evaluate(() => !!document.querySelector('.scex-matrix'))
  if (ok) break
  await page.waitForTimeout(500)
}
// Let avatars/matrix settle
await page.waitForTimeout(7000)

// Prefer clip of the product grid if present
const clip = await page.evaluate(() => {
  const el =
    document.querySelector('.scex-page') ||
    document.querySelector('main') ||
    document.body
  const r = el.getBoundingClientRect()
  // 1200x630 logical crop from top-left of product (banner + hero + matrix)
  return {
    x: Math.max(0, r.x),
    y: Math.max(0, r.y),
    width: Math.min(1200, window.innerWidth - Math.max(0, r.x)),
    height: Math.min(630, window.innerHeight - Math.max(0, r.y)),
  }
})

const pngPath = path.join(outDir, 'scex-og-clean.png')
// Full viewport at 1200x630
await page.setViewportSize({ width: 1200, height: 630 })
await page.waitForTimeout(1500)
await page.screenshot({ path: pngPath, type: 'png' })
console.log('png', pngPath, fs.statSync(pngPath).size)

// JPEG OG 1200x630, quality ~82
await sharp(pngPath)
  .resize(1200, 630, { fit: 'cover', position: 'top' })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(publicOg)
console.log('jpg', publicOg, fs.statSync(publicOg).size)

// also keep a hi-res archive
await sharp(pngPath)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(outDir, 'scex-og.jpg'))

await browser.close()
console.log('done', clip)
