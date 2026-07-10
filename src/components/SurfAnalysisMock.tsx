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
 */
export function SurfAnalysisMock({ kol }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)

  useEffect(() => {
    // Reset when switching KOL
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
    const pdfUrl = resolveSurfReportPdfUrl(kol)
    if (!pdfUrl) {
      setPhase('error')
      setMessage(
        'Chưa cấu hình link PDF R2. Vào Admin → điền “Surf default PDF (R2)” hoặc field PDF theo KOL, rồi Save.',
      )
      return
    }

    setPhase('running')
    setProgress(0)
    setMessage('Surf AI đang phân tích smart followers, engagement & mindshare…')

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
      setMessage('Phân tích xong — mở báo cáo PDF từ R2.')
      // Open PDF from R2 (public URL)
      try {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer')
      } catch {
        setMessage(`PDF sẵn sàng: ${pdfUrl}`)
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
        <p className="surf-analysis__sub">
          Mockup — giả lập pipeline Surf AI (~3s), trả báo cáo PDF trên R2.
        </p>
      </div>

      <button
        type="button"
        className={`surf-btn ${phase === 'running' ? 'is-running' : ''} ${phase === 'done' ? 'is-done' : ''}`}
        onClick={runAnalysis}
        disabled={phase === 'running'}
        title="Surf AI Analysis"
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

      {phase === 'done' && (
        <a
          className="surf-pdf-link"
          href={resolveSurfReportPdfUrl(kol)}
          target="_blank"
          rel="noreferrer"
        >
          📄 Mở lại PDF báo cáo
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
