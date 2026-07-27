/**
 * Full KOL reports seed (incl. private) — admin/offline only.
 * Dynamic-import from kolReportsStore when admin token present.
 */
import seedJson from './internal/kol-reports.json'
import {
  emptyKolReportsDataset,
  normalizeKolReportsDataset,
  type KolReportsDataset,
} from './kolReports'

export function adminSeedKolReportsDataset(): KolReportsDataset {
  const ds = normalizeKolReportsDataset(seedJson) || emptyKolReportsDataset()
  return {
    ...ds,
    reports: ds.reports.map((r) => ({
      ...r,
      changelog: [...(r.changelog || [])],
    })),
    trash: (ds.trash || []).map((r) => ({
      ...r,
      changelog: [...(r.changelog || [])],
    })),
  }
}
