import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { ReportMarkdown } from '../components/ReportMarkdown'
import { WalletButton } from './WalletButton'
import { useKolosseumWallet } from './useKolosseumWallet'
import { DEMO_DURATION } from './demoConfig'
import { loadDemoReport, type DemoReport } from './demoReport'
import { readDemoProgress, saveDemoProgress } from './demoStore'
const Arena = lazy(() => import('./arena/ColosseumScene'))
export function preloadSurfDemo() { void loadDemoReport().catch(() => {}); void import('./arena/ColosseumScene').catch(() => {}) }
function ArenaPoster() { return <div className="arena-poster" role="img" aria-label="Golden light over the Colosseum arena"><img src="/demo/arena-poster.jpg" alt="" /><span>KOLOSSEUM</span><small>THE ART OF CONVICTION</small></div> }
class ArenaBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <ArenaPoster /> : this.props.children }
}
export function SurfAiExperience() {
  const wallet = useKolosseumWallet()
  const [report, setReport] = useState<DemoReport | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [elapsed, setElapsed] = useState(() => readDemoProgress().elapsed)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(!document.hidden)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [resetCamera, setResetCamera] = useState(0)
  const reportHeading = useRef<HTMLHeadingElement>(null)
  const surface = useRef<HTMLElement>(null)
  const complete = elapsed >= DEMO_DURATION
  useEffect(() => {
    let active = true
    setError('')
    void loadDemoReport().then(r => { if (active) setReport(r) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load the saved report.') })
    return () => { active = false }
  }, [attempt])
  useEffect(() => {
    const onVisible = () => setVisible(!document.hidden), media = matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => setReduced(media.matches)
    document.addEventListener('visibilitychange', onVisible); media.addEventListener('change', onMotion)
    return () => { document.removeEventListener('visibilitychange', onVisible); media.removeEventListener('change', onMotion) }
  }, [])
  useEffect(() => {
    if (!wallet.address || !report || complete || !visible) return
    let last = performance.now()
    const tick = () => {
      const now = performance.now(), progress = readDemoProgress()
      const next = saveDemoProgress(progress.elapsed + now - last)
      last = now; setElapsed(next.elapsed)
    }
    const timer = window.setInterval(tick, 100)
    return () => { clearInterval(timer); tick() }
  }, [wallet.address, report, complete, visible])
  useEffect(() => { surface.current?.closest('.scex-detail__scroll')?.scrollTo(0, 0); if (complete) reportHeading.current?.focus({ preventScroll: true }) }, [complete, report, wallet.address])
  if (error) return <section className="surf-experience surf-empty"><span className="premium-eyebrow">RECORDED DEMO</span><h3>We couldn't open the report</h3><p role="alert">{error}</p><button onClick={() => setAttempt(a => a + 1)}>Try again</button></section>
  if (!wallet.address) return <section className="surf-experience surf-connect"><div className="surf-connect__seal">✦</div><span className="premium-eyebrow">SURFAI · RECORDED DEMO</span><h3>A sharper view of nbaluong.</h3><p>Connect your wallet to enter the arena and explore the saved SurfAI report.</p><WalletButton /><small>Solana Devnet experience · No signature or payment</small>{elapsed > 0 && <p>Your progress is saved. Reconnect to continue.</p>}</section>
  if (complete && report) {
    const sections = report.content.split(/(?=^## )/m).filter(s => s.trim())
    return <article ref={surface} className="surf-experience premium-report">
      <header><span className="premium-eyebrow">SURFAI / RECORDED DEMO</span><h3 ref={reportHeading} tabIndex={-1}>The nbaluong report</h3><p>Exchange stance & credibility · @{report.handle}</p><div className="premium-report__facts"><span>Source <b>{report.snapshotAt.slice(0, 10)}</b></span><span>Sample <b>{report.sampledPosts} / {report.postCount} posts</b></span><span>Model <b>{report.model}</b></span></div><p className="premium-caption">Saved analysis from {report.recordedAt.slice(0, 10)}. Replaying this report makes no new research or payment request.</p></header>
      <nav className="premium-report__toc" aria-label="Report contents">{sections.map((s, i) => <a key={i} href={`#surf-section-${i}`} onClick={e => { e.preventDefault(); document.getElementById(`surf-section-${i}`)?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }) }}>{s.split('\n')[0].replace(/^#+\s*/, '')}</a>)}</nav>
      {sections.map((s, i) => <section className="premium-report__section" id={`surf-section-${i}`} key={i}><ReportMarkdown text={s} /></section>)}
      <details className="premium-verification"><summary>Report integrity & provenance</summary><p>SHA-256 verified in this browser against the exported recording. This confirms saved content integrity, not the accuracy of every interpretation.</p><code>{report.contentHash}</code><p>This demo does not establish report ownership or verify a new on-chain payment.</p></details>
      <button onClick={() => { saveDemoProgress(0); setElapsed(0); setPaused(false) }}>Replay experience ↻</button>
    </article>
  }
  const stage = elapsed < 4000 ? 0 : elapsed < 9000 ? 1 : 2
  return <section ref={surface} className="surf-experience surf-loading" aria-busy="true">
    <div className="surf-loading__head"><span className="premium-eyebrow">SURFAI / RECORDED DEMO</span><span className="premium-network">nbaluong · 20 source posts</span></div>
    <h3>Conviction meets evidence.</h3><p>Your saved analysis is taking its place in the arena.</p>
    <div className="surf-arena"><ArenaBoundary>{reduced || !visible ? <ArenaPoster /> : <Suspense fallback={<ArenaPoster />}><Arena paused={paused} resetCamera={resetCamera} /></Suspense>}</ArenaBoundary><div className="surf-arena__caption">COLOSSEUM · ROMA <span>Drag to explore</span></div></div>
    <div className="surf-stage-status" role="status" aria-live="polite">{report ? ['Source snapshot', 'Analysis replay', 'Preparing report'][stage] : 'Opening saved report…'}</div>
    <div className="surf-progress" role="progressbar" aria-label="Recorded demo progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed / DEMO_DURATION * 100)}><i style={{ width: `${elapsed / DEMO_DURATION * 100}%` }} /></div>
    <ol className="surf-stages">{['Source snapshot', 'Analysis replay', 'Preparing report'].map((label, i) => <li className={i <= stage ? 'is-active' : ''} key={label}><span>{i < stage ? '✓' : `0${i + 1}`}</span>{label}</li>)}</ol>
    <div className="surf-actions"><button disabled={reduced} onClick={() => setPaused(p => !p)}>{paused ? 'Resume animation' : 'Pause animation'}</button><button onClick={() => setResetCamera(n => n + 1)} disabled={reduced}>Reset view</button><button className="premium-primary" disabled={!report} onClick={() => { saveDemoProgress(DEMO_DURATION); setElapsed(DEMO_DURATION) }}>Show report now →</button></div>
    <small className="premium-caption">A 12-second replay of a saved SurfAI analysis. No new research or payment.</small>
  </section>
}
