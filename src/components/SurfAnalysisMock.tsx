import { useCallback, useEffect, useRef, useState } from 'react'
import type { Kol } from '../types'
import type { KolReport } from '../data/kolReports'
import {
  loadPublicReportForHandle,
} from '../lib/kolReportsStore'
import { KolReportViewer } from './KolReportViewer'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface Props {
  kol: Kol
}

/**
 * Surf AI analysis mock → open in-app KOL Report (public) instead of PDF.
 * Admin: publish report in ★ KOL Reports for the handle to appear here.
 */
export function SurfAnalysisMock({ kol }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [report, setReport] = useState<KolReport | null>(null)
  const [hasReport, setHasReport] = useState<boolean | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeReport, setActiveReport] = useState<KolReport | null>(null)
  const timerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const runIdRef = useRef(0)

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  const prefetch = useCallback(async (force?: boolean) => {
    const r = await loadPublicReportForHandle(kol.handle, { force })
    setReport(r)
    setHasReport(!!r)
    return r
  }, [kol.handle])

  useEffect(() => {
    runIdRef.current += 1
    clearTimers()
    setPhase('idle')
    setProgress(0)
    setMessage(null)
    setViewerOpen(false)
    setActiveReport(null)
    setHasReport(null)
    setReport(null)
    void prefetch()
    return () => {
      runIdRef.current += 1
      clearTimers()
    }
  }, [kol.id, kol.handle, prefetch])

  const openReport = (r: KolReport) => {
    setActiveReport(r)
    setViewerOpen(true)
    setMessage('Phân tích xong — đang xem báo cáo trên Radar.')
  }

  const runAnalysis = () => {
    if (phase === 'running') return

    const runId = ++runIdRef.current
    setPhase('running')
    setProgress(0)
    setMessage(
      'Surf AI đang phân tích smart followers, engagement & mindshare…',
    )

    const started = Date.now()
    const DURATION = 3200
    clearTimers()

    tickRef.current = window.setInterval(() => {
      if (runId !== runIdRef.current) return
      const elapsed = Date.now() - started
      const t = Math.min(1, elapsed / DURATION)
      const eased = 1 - (1 - t) * (1 - t)
      setProgress(Math.min(99, eased * 100))
    }, 40)

    timerRef.current = window.setTimeout(() => {
      if (runId !== runIdRef.current) return
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      setProgress(100)
      setPhase('done')
      setMessage('Phân tích xong — đang tải báo cáo…')

      openTimerRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return
        void (async () => {
          const r = report || (await prefetch(true))
          if (runId !== runIdRef.current) return
          if (r) {
            openReport(r)
          } else {
            setPhase('error')
            setMessage(
              'Chưa có KOL Report public cho handle này. Admin → ★ KOL Reports → chọn KOL → Visibility Public → Save R2.',
            )
          }
        })()
      }, 450)
    }, DURATION)
  }

  const ready = hasReport === true
  const missing = hasReport === false

  return (
    <>
      <div className="surf-analysis glass">
        <div className="surf-analysis__head">
          <div className="surf-analysis__brand">
            <img
              src="/surf-logo.png"
              alt="Surf AI"
              className="surf-analysis__brand-logo"
              width={22}
              height={22}
              draggable={false}
            />
            <h3 className="surf-analysis__title">Surf AI Analysis</h3>
          </div>
          {hasReport === null ? (
            <span className="surf-analysis__pending">Đang kiểm tra…</span>
          ) : ready ? (
            <span className="surf-analysis__ready" title={report?.title || ''}>
              Report sẵn sàng
            </span>
          ) : (
            <span className="surf-analysis__missing">Chưa có report</span>
          )}
        </div>

        <button
          type="button"
          className={`surf-btn ${phase === 'running' ? 'is-running' : ''} ${phase === 'done' && ready ? 'is-done' : ''}`}
          onClick={runAnalysis}
          disabled={phase === 'running'}
          title={
            ready
              ? 'Chạy phân tích rồi mở KOL Report trên web'
              : 'Cần publish KOL Report (public) trong Admin'
          }
          aria-label="Chạy phân tích Surf AI"
        >
          <img
            src="/surf-logo.png"
            alt=""
            className="surf-btn__logo"
            width={18}
            height={18}
            draggable={false}
          />
          <span className="surf-btn__label">
            {phase === 'running'
              ? 'Analyzing…'
              : phase === 'done' && ready
                ? 'Xem lại report'
                : 'Surf AI'}
          </span>
        </button>

        {(phase === 'running' || phase === 'done') && (
          <div className="surf-progress" aria-hidden={phase !== 'running'}>
            <div className="surf-progress__track">
              <div
                className="surf-progress__fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="surf-progress__pct">{Math.round(progress)}%</span>
          </div>
        )}

        {message && (
          <p
            className={`surf-analysis__msg ${phase === 'error' ? 'is-error' : ''}`}
          >
            {message}
          </p>
        )}

        {ready && report && (phase === 'done' || phase === 'error') && (
          <button
            type="button"
            className="surf-report-link"
            onClick={() => openReport(report)}
          >
            📄 Mở KOL Report
          </button>
        )}

        {missing && (
          <p className="surf-analysis__hint">
            Publish report public trong Admin → ★ KOL Reports (cùng handle).
          </p>
        )}

        <ul className="surf-analysis__steps">
          <li className={progress > 8 ? 'is-on' : ''}>Profile & followers</li>
          <li className={progress > 35 ? 'is-on' : ''}>
            Smart followers (Surf AI)
          </li>
          <li className={progress > 65 ? 'is-on' : ''}>Engagement window</li>
          <li className={progress >= 100 ? 'is-on' : ''}>
            Mở KOL Report
          </li>
        </ul>
      </div>

      {viewerOpen && activeReport && (
        <KolReportViewer
          report={activeReport}
          avatarHandle={kol.handle}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  )
}
