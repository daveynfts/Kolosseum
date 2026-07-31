/**
 * @vitest-environment happy-dom
 */
import { readFileSync, existsSync } from 'fs'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const DOCX =
  'C:\\Users\\caokh\\OneDrive\\Documents\\KOL Report Docx\\Bao_cao_phan_tich_KOL_HuyLe_HC_SurfAI.docx'

vi.mock('./kolReportImageUpload', () => ({
  uploadKolReportImageBytes: vi.fn(async (_bytes: ArrayBuffer, opts?: { slot?: string }) => {
    const slot = opts?.slot || 'img'
    const url = `https://pub-8288264395e64bebab09946b5bc0b740.r2.dev/kol-reports/images/rep_test/${slot}.png?v=1`
    return {
      ok: true as const,
      url,
      key: `kol-reports/images/rep_test/${slot}.png`,
      filename: `rep_test/${slot}.png`,
      bytes: 1000,
      storage: 'r2' as const,
    }
  }),
}))

describe('DOCX HuyLe HC SurfAI images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts 4 PNGs into markdown that Live Preview can render', async () => {
    if (!existsSync(DOCX)) {
      console.warn('Skip: DOCX not on this machine')
      return
    }
    const { docxFileToReportMarkdown } = await import('./docxToReportMarkdown')
    const { markdownToHtml } = await import('./markdownToHtml')
    const { uploadKolReportImageBytes } = await import('./kolReportImageUpload')

    const file = new File([readFileSync(DOCX)], 'Bao_cao_phan_tich_KOL_HuyLe_HC_SurfAI.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const result = await docxFileToReportMarkdown(file, {
      token: 'test-token',
      handle: 'huyle_hc',
      reportId: 'rep_test_huyle',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.imagesUploaded).toBe(4)
    expect(result.imagesFailed).toBe(0)
    expect(result.imageUrls.length).toBe(4)
    expect(uploadKolReportImageBytes).toHaveBeenCalledTimes(4)

    const mdImgs = result.markdown.match(/!\[[^\]]*\]\(https:\/\/[^)]+\)/g) || []
    expect(mdImgs.length).toBeGreaterThanOrEqual(4)

    const html = markdownToHtml(result.markdown)
    const htmlImgs = (html.match(/<img\b/gi) || []).length
    expect(htmlImgs).toBeGreaterThanOrEqual(4)
    expect(html).toContain('report-md__img')
    expect(html).toContain('r2.dev/kol-reports/images/')
  })
})
