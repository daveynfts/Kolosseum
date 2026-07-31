/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdownToHtml'
import { htmlToMarkdown } from './htmlToMarkdown'

const R2 =
  'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev/kol-reports/images/rep_x/docx_2.png?v=1785293549725'

describe('markdownToHtml images', () => {
  it('renders R2 image with cache-buster query', () => {
    const html = markdownToHtml(`Intro\n\n![image](${R2})\n\nCap`)
    expect(html).toContain('<img')
    expect(html).toContain(R2.replace(/&/g, '&amp;'))
    expect(html).toContain('report-md__img')
  })

  it('roundtrips DOCX-like HTML with img to markdown and back', () => {
    const fromDocx = `<p>Hello</p><p><img src="${R2}" alt="image"></p><p><strong>Biểu đồ</strong></p>`
    const md = htmlToMarkdown(fromDocx, { loose: true })
    expect(md).toBeTruthy()
    expect(md!).toContain(`![image](${R2})`)
    const html = markdownToHtml(md!)
    expect(html).toContain('src="')
    expect(html).toContain('docx_2.png')
  })

  it('does not drop image lines when URL is safe', () => {
    const html = markdownToHtml(`![chart](${R2})`)
    expect(html.includes('figure') || html.includes('<img')).toBe(true)
  })
})
