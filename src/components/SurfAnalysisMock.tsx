import { useCallback, useEffect, useState } from 'react'
import type { Kol } from '../types'
import type { KolReport } from '../data/kolReports'
import { loadPublicReportForHandle } from '../lib/kolReportsStore'
import { KolReportViewer } from './KolReportViewer'
import '../styles/surfAnalysis.css'

/** Opens an existing public report for this KOL; no simulated analysis. */
export function SurfAnalysisMock({ kol }: { kol: Kol }) {
  const [report, setReport] = useState<KolReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)

  const refresh = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const found = await loadPublicReportForHandle(kol.handle, { force })
      setReport(found)
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [kol.handle])

  useEffect(() => {
    setReport(null)
    setViewerOpen(false)
    void refresh()
  }, [refresh])

  return (
    <>
      <div className="surf-analysis glass">
        <div className="surf-analysis__head">
          <div className="surf-analysis__brand">
            <img
              src="/surf-logo.png"
              alt=""
              className="surf-analysis__brand-logo"
              width={22}
              height={22}
              draggable={false}
            />
            <h3 className="surf-analysis__title">Public KOL report</h3>
          </div>
          {loading ? (
            <span className="surf-analysis__pending">Checking…</span>
          ) : report ? (
            <span className="surf-analysis__ready" title={report.title || ''}>Available</span>
          ) : (
            <span className="surf-analysis__missing">Not published</span>
          )}
        </div>

        {report ? (
          <button
            type="button"
            className="surf-btn"
            onClick={() => setViewerOpen(true)}
          >
            <span className="surf-btn__label">Open public report</span>
          </button>
        ) : (
          <p className="surf-analysis__hint">
            No public report is available for @{kol.handle}.
            {loading ? '' : ' An admin can publish one from the KOL Reports editor.'}
          </p>
        )}
        {!loading && !report && (
          <button type="button" className="surf-report-link" onClick={() => void refresh(true)}>
            Check again
          </button>
        )}
      </div>

      {viewerOpen && report && (
        <KolReportViewer
          report={report}
          avatarHandle={kol.handle}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  )
}
