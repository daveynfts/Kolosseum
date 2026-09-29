import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Render the shared SVG mark into browser and social assets. No external requests.
const mark = await fs.readFile(new URL('../public/kolosseum-mark.svg', import.meta.url), 'utf8');
const symbol = mark.match(/<g fill[\s\S]*<\/g>/)?.[0];
if (!symbol) throw new Error('The brand SVG must contain its shared geometry group.');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<title>Kolosseum — The Vietnamese Crypto KOL Arena</title>
<rect width="1200" height="630" fill="#100f12"/>
<rect x="28" y="28" width="1144" height="574" rx="22" fill="none" stroke="#c6a363" stroke-opacity=".22"/>
<g transform="translate(72 60) scale(.5)">${symbol}</g>
<text x="158" y="103" fill="#c6a363" font-family="Arial,sans-serif" font-weight="700" font-size="24" letter-spacing="5">KOLOSSEUM</text>
<text x="76" y="268" fill="#f1ece3" font-family="Georgia,serif" font-size="76">Discover voices.</text>
<text x="76" y="358" fill="#c6b28e" font-family="Georgia,serif" font-size="76">Find perspective.</text>
<text x="78" y="430" fill="#aaa397" font-family="Arial,sans-serif" font-size="23">The Vietnamese crypto KOL arena</text>
<path d="M78 496H650" stroke="#c6a363" stroke-opacity=".22"/>
<text x="78" y="539" fill="#c6a363" font-family="Arial,sans-serif" font-size="14" letter-spacing="3">PEOPLE · CONVERSATIONS · CONVICTION</text>
<g transform="translate(852 218) scale(2)">${symbol}</g>
</svg>`;
await fs.writeFile(new URL('../public/kolosseum-og.svg', import.meta.url), og);
const browser = await chromium.launch(process.env.BROWSER_EXECUTABLE
  ? { executablePath: process.env.BROWSER_EXECUTABLE, headless: true }
  : { channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(file, width, height, content) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${content}`);
    await page.screenshot({ path: fileURLToPath(new URL('../public/' + file, import.meta.url)), omitBackground: true });
  }
  await render('kolosseum-og.png', 1200, 630, og);
  for (const size of [32, 64]) await render('favicon-' + size + '.png', size, size, mark);
  await render('kolosseum-icon-180.png', 180, 180, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" rx="36" fill="#100f12"/><g transform="translate(26 26)">${symbol}</g></svg>`);
  console.log('Updated OG, Apple touch icon, and 32/64 px favicons from kolosseum-mark.svg.');
} finally { await browser.close(); }
