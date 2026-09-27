import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const output = join(tmpdir(), 'kolosseum-matrix-review')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ hasTouch: true })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const [width, height] of [[390, 844], [375, 667], [768, 1024], [844, 390], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await page.goto('http://127.0.0.1:5173/scex')
    const matrix = page.locator('.scex-matrix')
    const plot = matrix.locator('.scex2d-plot')
    await matrix.locator('.scex-bubble').first().waitFor()
    await matrix.scrollIntoViewIfNeeded()
    const geometry = await matrix.evaluate(el => {
      const card = el.getBoundingClientRect(), plot = el.querySelector('.scex2d-plot').getBoundingClientRect()
      const legend = el.querySelector('.scex2d-encode').getBoundingClientRect()
      return { cardBottom: card.bottom, plotBottom: plot.bottom, legendBottom: legend.bottom, plotHeight: plot.height, pageOverflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert(geometry.plotHeight >= 290, `usable plot at ${width}`)
    assert(geometry.plotBottom <= geometry.cardBottom && geometry.legendBottom <= geometry.cardBottom, `matrix not clipped at ${width}`)
    assert.equal(geometry.pageOverflow, false, `no horizontal page overflow at ${width}`)
    assert.equal(await plot.evaluate(el => getComputedStyle(el).touchAction), 'pan-y pinch-zoom')
    await plot.hover()
    const before = await page.locator('.premium-arena-page').evaluate(el => el.scrollTop)
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(250)
    const after = await page.locator('.premium-arena-page').evaluate(el => el.scrollTop)
    assert(after < before || before === 0, 'wheel over inline matrix scrolls page')
    assert.equal(await plot.getAttribute('class').then(s => s.includes('is-zoomed')), false)
    await matrix.getByRole('button', { name: 'Fullscreen', exact: true }).click()
    await matrix.getByRole('button', { name: 'Zoom in', exact: true }).click()
    assert.equal(await plot.evaluate(el => getComputedStyle(el).touchAction), 'none')
    const bubble = matrix.locator('.scex-bubble').nth(20)
    const box = await bubble.boundingBox()
    const bounds = await plot.boundingBox()
    if (box && box.x > bounds.x && box.x < bounds.x + bounds.width && box.y > bounds.y && box.y < bounds.y + bounds.height) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 30, { steps: 5 })
      await page.mouse.up()
      assert.equal(await page.getByRole('dialog').count(), 0, 'dragging from an avatar does not open profile')
    }
    await matrix.getByRole('button', { name: /Fit/ }).click()
    const fullscreen = await matrix.boundingBox()
    const controls = await matrix.locator('.scex2d-controls').boundingBox()
    const fullPlot = await plot.boundingBox()
    assert(fullscreen.y >= -1 && fullscreen.y + fullscreen.height <= height + 1, `fullscreen fits ${width}x${height}`)
    assert(fullPlot.height > 120 && fullPlot.y + fullPlot.height <= controls.y, 'plot and controls remain visible')
    assert(controls.y + controls.height <= height + 1, 'Fit controls remain reachable')
    await page.screenshot({ path: join(output, `matrix-${width}x${height}.png`) })
    await matrix.getByRole('button', { name: 'Exit · Esc', exact: true }).click()
  }
  assert.deepEqual(errors, [])
  console.log('PASS: inline scrolling, unclipped matrix, fullscreen, zoom/pan/Fit at six viewports. Screenshots: ' + output)
} finally { await browser.close() }
