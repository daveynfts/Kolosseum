/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { markdownToHtml } from './markdownToHtml'
import { htmlToMarkdown, normalizeMarkdown } from './htmlToMarkdown'

describe('Live Preview image survival', () => {
  it('keeps images through markdownToHtml → contentEditable innerHTML → htmlToMarkdown', () => {
    const sample = JSON.parse(
      readFileSync(
        join(__dirname, '../data/internal/kol-reports.json'),
        'utf8',
      ),
    )
    const report = sample.reports.find((r: { text: string }) =>
      /!\[[^\]]*\]\(https:/.test(r.text),
    )
    expect(report).toBeTruthy()
    const md = report.text as string
    const before = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
    expect(before).toBeGreaterThan(0)

    const html = markdownToHtml(normalizeMarkdown(md))
    expect((html.match(/<img\b/gi) || []).length).toBeGreaterThan(0)

    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    el.className = 'report-md report-md--editable'
    el.innerHTML = html
    document.body.appendChild(el)

    expect((el.innerHTML.match(/<img\b/gi) || []).length).toBeGreaterThan(0)
    expect(el.querySelectorAll('img').length).toBeGreaterThan(0)

    const back = htmlToMarkdown(el.innerHTML, { loose: true })
    expect(back).toBeTruthy()
    const after = (back!.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
    expect(after).toBe(before)

    el.remove()
  })

  it('does not drop images when figcaption mirrors are scrubbed', () => {
    const url =
      'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev/kol-reports/images/rep_x/docx_1.png?v=9'
    const md = `Hello\n\n![image](${url})\n\n*image*\n\nMore`
    const cleaned = normalizeMarkdown(md)
    expect(cleaned).toContain(`![image](${url})`)
    expect(cleaned).not.toMatch(/\*image\*/)
    const html = markdownToHtml(cleaned)
    expect(html).toContain('<img')
    const back = htmlToMarkdown(html, { loose: true })
    expect(back).toContain(`![image](${url})`)
  })
})
