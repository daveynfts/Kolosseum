/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  htmlToMarkdown,
  normalizeMarkdown,
  scrubMirroredImageCaptions,
} from './htmlToMarkdown'
import { markdownToHtml } from './markdownToHtml'
import { isGenericImageAlt } from './imageAlt'

const SAMPLE_URL =
  'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev/kol-reports/images/rep_x/docx_2.png?v=1'

describe('isGenericImageAlt', () => {
  it('flags upload placeholders', () => {
    expect(isGenericImageAlt('image')).toBe(true)
    expect(isGenericImageAlt('Image')).toBe(true)
    expect(isGenericImageAlt('img')).toBe(true)
    expect(isGenericImageAlt('')).toBe(true)
    expect(isGenericImageAlt('Biểu đồ 2')).toBe(false)
  })
})

describe('scrubMirroredImageCaptions', () => {
  it('removes duplicated *image* lines after markdown images', () => {
    const dirty = [
      `![image](${SAMPLE_URL})`,
      '',
      '*image*',
      '*image*',
      '**Biểu đồ 2.** Phễu cộng đồng',
    ].join('\n')
    const clean = scrubMirroredImageCaptions(dirty)
    expect(clean).toContain(`![image](${SAMPLE_URL})`)
    expect(clean).not.toMatch(/\*image\*/)
    expect(clean).toContain('**Biểu đồ 2.** Phễu cộng đồng')
  })
})

describe('html ↔ markdown image roundtrip', () => {
  it('does not spawn *image* captions from alt mirrors', () => {
    const md = `![image](${SAMPLE_URL})\n\n**Biểu đồ 2.** Caption thật`
    const html = markdownToHtml(md)
    expect(html).toContain(`alt="image"`)
    expect(html).not.toContain('figcaption')
    const back = htmlToMarkdown(html, { loose: true })
    expect(back).toBeTruthy()
    expect(back!).toContain(`![image](${SAMPLE_URL})`)
    expect(back!).not.toMatch(/\*image\*/)
    expect(back!).toContain('**Biểu đồ 2.** Caption thật')
  })

  it('marks non-generic alt figcaption as mirror-only', () => {
    const md = `![Revenue chart](${SAMPLE_URL})`
    const html = markdownToHtml(md)
    expect(html).toContain('data-md-alt-mirror="1"')
    const back = htmlToMarkdown(html, { loose: true })
    expect(back).toBe(`![Revenue chart](${SAMPLE_URL})`)
    expect(back).not.toMatch(/\*Revenue chart\*/)
  })

  it('is stable across multiple roundtrips', () => {
    let md = `Intro\n\n![image](${SAMPLE_URL})\n\n**Biểu đồ 2.** Cap\n`
    for (let i = 0; i < 4; i++) {
      const html = markdownToHtml(md)
      const next = htmlToMarkdown(html, { loose: true })
      expect(next).toBeTruthy()
      md = next!
    }
    expect(md.match(/!\[image\]/g)?.length).toBe(1)
    expect(md).not.toMatch(/\*image\*/)
  })

  it('cleans already-corrupted markdown via normalizeMarkdown', () => {
    const dirty = `![image](${SAMPLE_URL})\n\n*image*\n\n*image*\n\n**Ok**`
    expect(normalizeMarkdown(dirty)).toBe(
      `![image](${SAMPLE_URL})\n\n**Ok**`,
    )
  })

  it('skips figcaption that equals alt even without data attribute', () => {
    const html = `<figure><img src="${SAMPLE_URL}" alt="Chart A" /><figcaption>Chart A</figcaption></figure>`
    const md = htmlToMarkdown(html, { loose: true })
    expect(md).toBe(`![Chart A](${SAMPLE_URL})`)
  })

  it('preserves empty alt', () => {
    const html = `<p><img src="${SAMPLE_URL}" alt="" /></p>`
    const md = htmlToMarkdown(html, { loose: true })
    expect(md).toBe(`![](${SAMPLE_URL})`)
  })

  it('drops javascript and data hrefs', () => {
    const html =
      '<p><a href="javascript:alert(1)">x</a> <a href="data:text/html,hi">y</a> <a href="https://x.com/a">z</a></p>'
    const md = htmlToMarkdown(html, { loose: true })
    expect(md).not.toContain('javascript:')
    expect(md).not.toContain('data:text/html')
    expect(md).toContain('[z](https://x.com/a)')
    expect(md).toContain('x')
    expect(md).toContain('y')
  })
})

describe('blockquote roundtrip', () => {
  it('keeps multi-line quotes', () => {
    const md = '> line one\n> line two'
    const html = markdownToHtml(md)
    const back = htmlToMarkdown(html, { loose: true })
    expect(back).toContain('> line one')
    expect(back).toContain('> line two')
  })
})
