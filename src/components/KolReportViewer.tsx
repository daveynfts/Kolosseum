import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { KolReport } from '../data/kolReports'
import { ReportMarkdown } from './ReportMarkdown'
import { XProfileAvatar } from './XProfileAvatar'
import { resolveAvatarHandle } from '../lib/avatar'
import { cssSafeUrl } from '../lib/safeUrl'
/** Required on /scex (does not load App.css). Shared with main Radar. */
import '../styles/surfAnalysis.css'

interface Props {
  report: KolReport
  /** Optional map-style handle casing for avatars */
  avatarHandle?: string
  onClose: () => void
}

/**
 * Full-screen reader for a public KOL evaluation report (replaces PDF tab).
 * Portaled to document.body so it is never trapped under SCEX feed fullscreen
 * (z-index 20050+) or overflow:hidden ancestors.
 */
export function KolReportViewer({ report, avatarHandle, onClose }: Props) {
  const handle = resolveAvatarHandle(
    avatarHandle || report.handle,
    avatarHandle ? [{ handle: avatarHandle }] : undefined,
  )
  const score = report.structured?.overallScore

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    // Capture phase so we win over SCEX feed / matrix Esc handlers
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const ui = (
    <div
      className="kol-report-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={report.title || `Báo cáo @${report.handle}`}
    >
      <button
        type="button"
        className="kol-report-viewer__backdrop"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="kol-report-viewer__panel glass">
        <header className="kol-report-viewer__top">
          <div className="kol-report-viewer__brand">
            <img
              src="/surf-logo.png"
              alt=""
              width={22}
              height={22}
              draggable={false}
            />
            <span>KOL Report</span>
          </div>
          <button
            type="button"
            className="kol-report-viewer__close"
            onClick={onClose}
          >
            Đóng · Esc
          </button>
        </header>

        {cssSafeUrl(report.coverImage) ? (
          <div
            className="kol-report-viewer__cover"
            style={{
              backgroundImage: `url(${cssSafeUrl(report.coverImage)})`,
            }}
          >
            <div className="kol-report-viewer__cover-fade" />
          </div>
        ) : null}

        <div className="kol-report-viewer__scroll">
          <article className="kol-report-viewer__article">
            <header className="akr-reader__head">
              <div className="kol-report-viewer__identity">
                <XProfileAvatar
                  handle={handle}
                  name={report.displayName || report.handle}
                  size={48}
                  liveFallback
                />
                <div>
                  <p className="akr-reader__kicker">Surf AI · Evaluation</p>
                  <h1 className="akr-reader__title">{report.title}</h1>
                  <div className="akr-reader__meta">
                    <span>@{report.handle}</span>
                    {report.displayName &&
                      report.displayName.toLowerCase() !==
                        report.handle.toLowerCase() && (
                        <span>{report.displayName}</span>
                      )}
                    {score != null && (
                      <span className="akr-score-chip">{score}/100</span>
                    )}
                    <time dateTime={report.updatedAt}>
                      Cập nhật{' '}
                      {new Date(report.updatedAt).toLocaleString('vi-VN')}
                    </time>
                  </div>
                </div>
              </div>
            </header>

            <ReportMarkdown
              text={report.text}
              className="report-md--reader"
            />

            {(report.tags || []).length > 0 && (
              <footer className="kol-report-viewer__tags">
                {(report.tags || []).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </footer>
            )}
          </article>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return ui
  return createPortal(ui, document.body)
}
