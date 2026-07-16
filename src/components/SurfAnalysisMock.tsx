import { useEffect, useRef, useState } from 'react'
import type { Kol } from '../types'
import { resolveSurfReportPdfUrl } from '../lib/kolStore'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface Props {
  kol: Kol
}

/**
 * Mockup: Surf AI analysis.
 * Full progress animation (~3s) in-panel first, then open PDF.
 * Does NOT open a tab on click (that felt like “file opens immediately”).
 */
export function SurfAnalysisMock({ kol }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const timerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const runIdRef = useRef(0)
  const pdfUrl = resolveSurfReportPdfUrl(kol)

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

  useEffect(() => {
    runIdRef.current += 1
    clearTimers()
    setPhase('idle')
    setProgress(0)
    setMessage(null)
    setPopupBlocked(false)
    return () => {
      runIdRef.current += 1
      clearTimers()
    }
  }, [kol.id])

  const openPdf = (url: string) => {
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) {
      setPopupBlocked(true)
      setMessage(
        'Phân tích xong — trình duyệt chặn popup. Bấm “Mở PDF báo cáo” bên dưới.',
      )
      return false
    }
    setPopupBlocked(false)
    setMessage('Phân tích xong — đã mở báo cáo PDF.')
    return true
  }

  const runAnalysis = () => {
    if (phase === 'running') return
    if (!pdfUrl) {
      setPhase('error')
      setPopupBlocked(false)
      setMessage(
        'Chưa cấu hình link báo cáo R2 trên server. Admin → Edit KOL → dán URL public (…/RadarKOLsReport/….pdf hoặc .docx) → bấm Save (cần token). Chỉ upload file lên bucket chưa đủ.',
      )
      return
    }

    const runId = ++runIdRef.current
    const targetUrl = pdfUrl

    setPhase('running')
    setProgress(0)
    setPopupBlocked(false)
    setMessage(
      'Surf AI đang phân tích smart followers, engagement & mindshare…',
    )

    const started = Date.now()
    const DURATION = 3200
    clearTimers()

    // Smooth progress 0 → 100 over DURATION (mock pipeline)
    tickRef.current = window.setInterval(() => {
      if (runId !== runIdRef.current) return
      const elapsed = Date.now() - started
      // Ease-out so last steps linger a bit
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
      // Finish bar + light final step before opening file
      setProgress(100)
      setPhase('done')
      setMessage('Phân tích xong — đang mở báo cáo…')

      openTimerRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return
        openPdf(targetUrl)
      }, 450)
    }, DURATION)
  }

  const showPdfLink =
    !!pdfUrl && (phase === 'done' || phase === 'error' || popupBlocked)

  return (
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
        {pdfUrl ? (
          <span className="surf-analysis__ready" title={pdfUrl}>
            PDF sẵn sàng
          </span>
        ) : (
          <span className="surf-analysis__missing">Chưa gắn PDF</span>
        )}
      </div>

      <button
        type="button"
        className={`surf-btn ${phase === 'running' ? 'is-running' : ''} ${phase === 'done' ? 'is-done' : ''}`}
        onClick={runAnalysis}
        disabled={phase === 'running'}
        title={
          pdfUrl
            ? 'Chạy phân tích Surf AI (mock) rồi mở PDF'
            : 'Chưa có link PDF — cấu hình trong Admin'
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
            : phase === 'done'
              ? 'Run again'
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

      {showPdfLink && pdfUrl && (
        <a
          className="surf-pdf-link"
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
        >
          📄 Mở PDF báo cáo
        </a>
      )}

      <ul className="surf-analysis__steps">
        <li className={progress > 8 ? 'is-on' : ''}>Profile & followers</li>
        <li className={progress > 35 ? 'is-on' : ''}>
          Smart followers (Surf AI)
        </li>
        <li className={progress > 65 ? 'is-on' : ''}>Engagement window</li>
        <li className={progress >= 100 ? 'is-on' : ''}>Hoàn tất phân tích</li>
      </ul>
    </div>
  )
}
