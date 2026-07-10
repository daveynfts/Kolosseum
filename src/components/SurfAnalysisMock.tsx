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
    setMessage('Surf đang phân tích smart followers, engagement & mindshare…')

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
        <div>
          <h3 className="surf-analysis__title">Phân tích AI · Surf</h3>
          <p className="surf-analysis__sub">
            Mockup — giả lập pipeline Surf (~3s), trả báo cáo PDF đã lưu trên R2.
          </p>
        </div>
      </div>

      <button
        type="button"
        className={`surf-btn ${phase === 'running' ? 'is-running' : ''} ${phase === 'done' ? 'is-done' : ''}`}
        onClick={runAnalysis}
        disabled={phase === 'running'}
        title="Chạy phân tích AI (Surf mock)"
        aria-label="Chạy phân tích Surf AI"
      >
        <SurfLogo />
        <span className="surf-btn__label">
          {phase === 'running'
            ? 'Analyzing…'
            : phase === 'done'
              ? 'Chạy lại'
              : 'Analyze with Surf'}
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
        <li className={progress > 35 ? 'is-on' : ''}>Smart followers (Surf)</li>
        <li className={progress > 65 ? 'is-on' : ''}>Engagement window</li>
        <li className={progress >= 100 ? 'is-on' : ''}>Export PDF → R2</li>
      </ul>
    </div>
  )
}

/** Stylized Surf mark (mock brand lockup — not official asset) */
function SurfLogo() {
  return (
    <span className="surf-logo" aria-hidden>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="surfGrad" x1="4" y1="4" x2="28" y2="28">
            <stop stopColor="#22d3ee" />
            <stop offset="0.55" stopColor="#818cf8" />
            <stop offset="1" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#surfGrad)" />
        <path
          d="M6 18c3-6 6-8 10-6s7 2 10-2"
          stroke="#0b1020"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        <path
          d="M6 22c3.5-4.5 6.5-5.5 10-3.5s6.5 1.5 10-2"
          stroke="#0b1020"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
        <circle cx="22" cy="10" r="2.2" fill="#0b1020" opacity="0.75" />
      </svg>
    </span>
  )
}
