import { useEffect, useState } from 'react'
import { ReportMarkdown } from '../components/ReportMarkdown'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { safeHref } from '../lib/safeUrl'
import { ADMIN_TOKEN_SESSION_KEY, researchApi } from './api'
import { useKolosseumWallet } from './useKolosseumWallet'
import { WalletControls } from './WalletControls'
import './research.css'

type Replay = {
  recordedAt: string
  status: 'source-ready' | 'report-ready' | 'purchase-verified'
  limitation: string | null
  steps: Array<{ name: string; status: 'verified' | 'pending' | 'blocked'; detail: string }>
  source: { asOf: string; updatedAt: string | null; actorCount: number; postCount: number; topKolPostCount: number }
  kol: { handle: string; displayName: string; followers: number; qualityScore: number; postsVolume: number; matrix: { x: number; y: number } }
  posts: Array<{ id: string; url: string; text: string; postedAt: string }>
  template: { slug: string; title: string; description: string; priceUsdc: string }
  report: null | { id: string; content: string; contentHash: string; surfModel: string; surfUsage: { creditsUsed: number | null; creditsSource?: 'provider' | 'published-rate' | 'cache'; cacheHit: boolean }; createdAt: string }
  payment: null | { protocol: string; buyerWallet: string; priceChargedUsdc: string; channel: null | { id: string; capUsdc: string; spentUsdc: string; remainingUsdc: string; status: string } }
  verification: null | { onChainMatch: boolean | null; evidenceTx: string | null; explorerUrl: string | null; votes: { up: number; down: number; supportUsdc: string; challengeUsdc: string } }
}

type Playback = 'idle' | 'playing' | 'complete'

async function browserHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function RecordedDemoPage() {
  const wallet = useKolosseumWallet()
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
  const [capture, setCapture] = useState<Replay | null>(null)
  const [hashMatch, setHashMatch] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [playback, setPlayback] = useState<Playback>('idle')
  const [visibleSteps, setVisibleSteps] = useState(0)

  useEffect(() => { document.title = 'Recorded walkthrough — Kolosseum' }, [])

  async function load(value: string) {
    if (!value.trim()) { setError('Enter the local ADMIN_TOKEN to open the recording.'); return }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(researchApi('/research/demo-replay'), {
        headers: { Authorization: 'Bearer ' + value.trim() }, cache: 'no-store',
      })
      if (!response.ok) throw new Error(response.status === 401 ? 'ADMIN_TOKEN was not accepted.' : 'Recorded walkthrough is unavailable.')
      const data = await response.json() as Replay
      if (data.report?.content) setHashMatch((await browserHash(data.report.content)) === data.report.contentHash)
      else setHashMatch(null)
      setCapture(data)
      setPlayback('idle')
      setVisibleSteps(0)
      sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, value.trim())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the recording.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY)
    if (saved) void load(saved)
  }, [])

  useEffect(() => {
    if (!capture || playback !== 'playing') return
    if (visibleSteps >= capture.steps.length) {
      setPlayback('complete')
      return
    }
    const timer = window.setTimeout(() => setVisibleSteps((count) => count + 1), 550)
    return () => window.clearTimeout(timer)
  }, [capture, playback, visibleSteps])

  function startPlayback() {
    setVisibleSteps(0)
    setPlayback('playing')
  }

  function showSavedResult() {
    if (!capture) return
    setVisibleSteps(capture.steps.length)
    setPlayback('complete')
  }

  const isComplete = playback === 'complete'

  return (
    <main className="dr-report-page dr-replay-page">
      <nav className="dr-report-page__nav"><a href="/scex">← Back to the KOL arena</a></nav>
      <div className="dr-panel__banner">RECORDED SANDBOX WALKTHROUGH · NO NEW SURF OR PAYMENT CALLS</div>
      <h1>Deep Research walkthrough</h1>
      <p className="dr-report-page__meta">Create the report experience from a verified recording. This is a dated snapshot, not a new report or purchase.</p>
      {!capture && (
        <div className="dr-report-page__unlock">
          <label>ADMIN_TOKEN (local recording)
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
          </label>
          <button type="button" disabled={busy} onClick={() => { void load(token) }}>{busy ? 'Opening…' : 'Open recorded walkthrough'}</button>
        </div>
      )}
      {error && <p className="dr-panel__error" role="alert">{error}</p>}
      {capture && (
        <>
          <section className="dr-replay-kol" aria-label="Recorded KOL selection">
            <div className="dr-replay-kol__identity">
              <XProfileAvatar handle={capture.kol.handle} name={capture.kol.displayName} size={76} />
              <div>
                <small>SELECTED KOL · RECORDED RADAR DATA</small>
                <h2>{capture.kol.displayName}</h2>
                <a href={'https://x.com/' + encodeURIComponent(capture.kol.handle)} target="_blank" rel="noreferrer">@{capture.kol.handle} ↗</a>
              </div>
            </div>
            <div className="dr-replay-kol__stats">
              <span><b>{capture.source.topKolPostCount}</b> SCEX posts in snapshot</span>
              <span><b>{capture.posts.length}</b> posts supplied to research</span>
              <span><b>{new Intl.NumberFormat('en-US').format(capture.kol.followers)}</b> followers</span>
              <span><b>{capture.kol.qualityScore.toFixed(1)}</b> credibility score</span>
            </div>
            <p>Radar data as of {capture.source.asOf}; capture saved {new Date(capture.recordedAt).toLocaleString('en-US')}. The avatar loads from the existing R2 source.</p>
          </section>

          <section className="dr-me__section dr-replay-setup" aria-label="Recorded report setup">
            <h2>Report setup</h2>
            <p><strong>{capture.template.title}</strong> · {capture.template.slug === 'custom-deep' ? 'maximum' : 'quoted'} ${capture.template.priceUsdc} sandbox USDC in the original run.</p>
            <p>{capture.template.description}</p>
            <div className="dr-replay-setup__wallet">
              <strong>Connect a Solana wallet</strong>
              <WalletControls wallet={wallet} />
              <small>Phantom or Solflare connects your real wallet here. This replay requests no signature, sends no payment, and does not make this wallet the buyer of the recorded report.</small>
              {capture.payment && <small>Recorded sandbox buyer: {capture.payment.buyerWallet}</small>}
            </div>
            <div className="dr-replay-controls">
              <button type="button" onClick={startPlayback} disabled={playback === 'playing'}>
                {playback === 'playing' ? 'Replaying recorded creation…' : isComplete ? 'Replay creation again' : 'Create report from recording'}
              </button>
              <button type="button" className="dr-replay-controls__secondary" onClick={showSavedResult} disabled={isComplete}>Show saved result now</button>
            </div>
            <small>Both buttons use the capture already loaded in this page. They do not call Surf, pay.sh, PostgreSQL, or Solana.</small>
          </section>

          {playback !== 'idle' && (
            <section className="dr-me__section" aria-label="Recorded flow">
              <h2>Recorded creation flow</h2>
              <p className="dr-replay-progress" role="status">{visibleSteps} of {capture.steps.length} recorded stages shown{isComplete ? ' · report ready' : '…'}</p>
              <ol className="dr-replay-steps">
                {capture.steps.slice(0, visibleSteps).map((step, index) => (
                  <li key={step.name + '-' + index} className={'dr-replay-steps__' + step.status}>
                    <span className="dr-replay-steps__number">{index + 1}</span>
                    <div><strong>{step.name}</strong><small>{step.detail}</small></div>
                    <b>{step.status}</b>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {isComplete && (
            <>
              {capture.limitation && <p className="dr-panel__notice">{capture.limitation}</p>}
              {capture.payment && (
                <section className="dr-verify" aria-label="Recorded sandbox payment">
                  <strong>Sandbox payment verified at capture</strong>
                  <span>{capture.payment.protocol} · ${capture.payment.priceChargedUsdc} sandbox USDC · buyer {capture.payment.buyerWallet}</span>
                  {capture.payment.channel && <span>Channel {capture.payment.channel.status} · cap ${capture.payment.channel.capUsdc} · spent ${capture.payment.channel.spentUsdc} · remaining ${capture.payment.channel.remainingUsdc}</span>}
                </section>
              )}
              {capture.report && (
                <section className="dr-verify" aria-label="Recorded report verification">
                  <strong>{hashMatch ? '✓ Report SHA-256 matches in this browser' : '⚠ Report hash could not be confirmed'}</strong>
                  <code>SHA-256: {capture.report.contentHash}</code>
                  <span>{capture.report.surfModel} · {capture.report.surfUsage.cacheHit ? 'reused encrypted cache · 0 new Surf credits' : (capture.report.surfUsage.creditsUsed ?? 'unknown') + ' Surf credits (' + (capture.report.surfUsage.creditsSource ?? 'source unknown') + ')'}</span>
                  {capture.verification?.explorerUrl && safeHref(capture.verification.explorerUrl) && (
                    <a href={capture.verification.explorerUrl} target="_blank" rel="noreferrer">
                      {capture.verification.onChainMatch ? '✓ Devnet Memo verified at capture ↗' : 'Devnet Memo link (not verified at capture) ↗'}
                    </a>
                  )}
                  {capture.verification && <span>Recorded votes: {capture.verification.votes.up} support / {capture.verification.votes.down} challenge.</span>}
                </section>
              )}
              <section className="dr-me__section" aria-label="Source posts">
                <h2>Source posts</h2>
                <p>The recording contains {capture.posts.length} public posts for @{capture.kol.handle}. Links open the original X sources.</p>
                <div className="dr-me__list">
                  {capture.posts.slice(0, 5).map((post) => (
                    <div className="dr-me__item" key={post.id}>
                      <small>{new Date(post.postedAt).toLocaleString('en-US')}</small>
                      <p>{post.text.slice(0, 360)}{post.text.length > 360 ? '…' : ''}</p>
                      {safeHref(post.url) && <a href={post.url} target="_blank" rel="noreferrer">Original X post ↗</a>}
                    </div>
                  ))}
                </div>
              </section>
              {capture.report?.content && <article className="dr-report-page__content"><ReportMarkdown text={capture.report.content} /></article>}
              <small className="dr-replay-page__footnote">Read-only recording. A new live report requires a separate Surf request and sandbox payment.</small>
            </>
          )}
        </>
      )}
    </main>
  )
}
