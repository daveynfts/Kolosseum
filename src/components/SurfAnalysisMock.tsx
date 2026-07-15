import { useEffect, useRef, useState } from 'react'
import type { Kol } from '../types'
import { resolveSurfReportPdfUrl } from '../lib/kolStore'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface Props {
  kol: Kol
}

/**
 * Mockup: Surf AI analysis button.
 * Runs ~3s then opens PDF from R2 (admin-configured URL).
 * Opens a tab on click (user gesture) so popup blockers don't kill the PDF.
 */
export function SurfAnalysisMock({ kol }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const pdfUrl = resolveSurfReportPdfUrl(kol)

  useEffect(() => {
    setPhase('idle')
    setProgress(0)
    setMessage(null)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [kol.id])

  const runAnalysis = () => {
    if (phase === 'running') return
    if (!pdfUrl) {
      setPhase('error')
      setMessage(
        'Chưa cấu hình link PDF R2. Vào Admin → Edit KOL → “PDF R2 URL” (hoặc Default PDF global) → Save (token) để publish server.',
      )
      return
    }

    // Open tab immediately under the click gesture (avoids popup block after 3s)
    const reportTab = window.open('about:blank', '_blank')
    if (reportTab) {
      try {
        reportTab.document.title = 'Surf AI — đang phân tích…'
        reportTab.document.body.innerHTML =
          '<p style="font-family:system-ui,sans-serif;padding:24px;color:#334155">Surf AI đang phân tích… báo cáo sẽ mở sau vài giây.</p>'
      } catch {
        /* cross-origin / restricted — ok */
      }
    }

    setPhase('running')
    setProgress(0)
    setMessage(
      'Surf AI đang phân tích smart followers, engagement & mindshare…',
    )

    const started = Date.now()
    const DURATION = 3000
    if (tickRef.current) window.clearInterval(tickRef.current)
    tickRef.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - started) / DURATION) * 100)
      setProgress(p)
    }, 50)

    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      setProgress(100)
      setPhase('done')

      if (reportTab && !reportTab.closed) {
        try {
          reportTab.location.href = pdfUrl
          setMessage('Phân tích xong — đã mở báo cáo PDF.')
        } catch {
          reportTab.close()
          setMessage('Phân tích xong — bấm link bên dưới để mở PDF.')
        }
      } else {
        // Popup blocked or closed — still try open + always show link
        const w = window.open(pdfUrl, '_blank', 'noopener,noreferrer')
        setMessage(
          w
            ? 'Phân tích xong — đã mở báo cáo PDF.'
            : 'Phân tích xong — trình duyệt chặn popup. Bấm “Mở PDF báo cáo” bên dưới.',
        )
      }
    }, DURATION)
  }

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
            ? 'Chạy phân tích Surf AI và mở PDF'
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

      {pdfUrl && (
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
        <li className={progress > 5 ? 'is-on' : ''}>Profile & followers</li>
        <li className={progress > 35 ? 'is-on' : ''}>Smart followers (Surf AI)</li>
        <li className={progress > 65 ? 'is-on' : ''}>Engagement window</li>
        <li className={progress >= 100 ? 'is-on' : ''}>Export PDF → R2</li>
      </ul>
    </div>
  )
}
