import { describe, expect, it } from 'vitest'
import {
  emptyKolReportsDataset,
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
