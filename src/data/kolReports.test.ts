import { describe, expect, it } from 'vitest'
import {
  emptyKolReportsDataset,
  extractKolReportSummary,
  publicKolReportsView,
  type KolReport,
} from './kolReports'

function sampleReport(
  handle: string,
  visibility: 'public' | 'private',
): KolReport {
  return {
    id: `rep_${handle}`,
    handle,
    title: `Report @${handle}`,
    text: 'body',
    visibility,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    changelog: [],
  }
}

describe('publicKolReportsView', () => {
  it('returns only public reports and empty trash', () => {
    const ds = {
      ...emptyKolReportsDataset(),
      reports: [
        sampleReport('public1', 'public'),
        sampleReport('secret1', 'private'),
      ],
      trash: [sampleReport('deleted', 'private')],
    }
    const pub = publicKolReportsView(ds)
    expect(pub.reports).toHaveLength(1)
    expect(pub.reports[0].handle).toBe('public1')
    expect(pub.trash).toEqual([])
  })
})

describe('extractKolReportSummary', () => {
  it('prefers TL;DR section over title noise', () => {
    const r: KolReport = {
      ...sampleReport('demo', 'public'),
      text: `# REPORT TITLE\n\n## TL;DR\n\nKOL mạnh community, engagement tốt, phù hợp brand awareness.\nKhông copy-trade.\n\n## Chi tiết\n\n${'x'.repeat(200)}`,
    }
    const s = extractKolReportSummary(r, 400)
    expect(s.toLowerCase()).toContain('community')
    expect(s.length).toBeLessThan(420)
  })

  it('uses structured strengths when present', () => {
    const r: KolReport = {
      ...sampleReport('demo2', 'public'),
      structured: {
        overallScore: 82,
        strengths: ['Nội dung sâu', 'Cộng đồng VN'],
        risks: ['Disclosure COI'],
      },
    }
    const s = extractKolReportSummary(r)
    expect(s).toMatch(/82\/100/)
    expect(s).toMatch(/Nội dung sâu/)
  })
})
