import { useEffect, useState } from 'react'
import { ReportMarkdown } from '../components/ReportMarkdown'
import { safeHref } from '../lib/safeUrl'
import { ADMIN_TOKEN_SESSION_KEY, researchApi } from './api'
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

async function browserHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function RecordedDemoPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
  const [capture, setCapture] = useState<Replay | null>(null)
  const [hashMatch, setHashMatch] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { document.title = 'Recorded walkthrough — Kolosseum' }, [])

  async function load(value: string) {
    if (!value.trim()) { setError('Enter the local ADMIN_TOKEN to open the recording.'); return }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(researchApi('/research/demo-replay'), {
        headers: { Authorization: `Bearer ${value.trim()}` }, cache: 'no-store',
      })
      if (!response.ok) throw new Error(response.status === 401 ? 'ADMIN_TOKEN was not accepted.' : 'Recorded walkthrough is unavailable.')
      const data = await response.json() as Replay
      if (data.report?.content) setHashMatch((await browserHash(data.report.content)) === data.report.contentHash)
      else setHashMatch(null)
      setCapture(data)
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

  return (
    <main className="dr-report-page dr-replay-page">
      <nav className="dr-report-page__nav"><a href="/scex">← Back to the KOL arena</a></nav>
      <div className="dr-panel__banner">RECORDED SANDBOX WALKTHROUGH · NO NEW SURF OR PAYMENT CALLS</div>
      <h1>Deep Research walkthrough</h1>
      <p className="dr-report-page__meta">This local replay preserves an actual test snapshot. It is not live data or a new purchase.</p>
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
          <section className="dr-verify">
            <strong>@{capture.kol.handle} · {capture.kol.displayName}</strong>
            <span>Captured {new Date(capture.recordedAt).toLocaleString('en-US')} · Radar data as of {capture.source.asOf}</span>
            <span>{capture.source.topKolPostCount} SCEX posts by this KOL · {capture.source.postCount} posts in the snapshot · {capture.source.actorCount} actors</span>
            <span>Template: {capture.template.title} · {capture.template.slug === 'custom-deep' ? 'maximum' : 'quoted'} ${capture.template.priceUsdc} sandbox USDC</span>
            {capture.limitation && <span className="dr-panel__notice">{capture.limitation}</span>}
          </section>
          <section className="dr-me__section" aria-label="Recorded flow">
            <h2>Recorded flow</h2>
            <ol className="dr-replay-steps">
              {capture.steps.map((step, index) => (
                <li key={`${step.name}-${index}`} className={`dr-replay-steps__${step.status}`}>
                  <span className="dr-replay-steps__number">{index + 1}</span>
                  <div><strong>{step.name}</strong><small>{step.detail}</small></div>
                  <b>{step.status}</b>
                </li>
              ))}
            </ol>
          </section>
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
    </main>
  )
}
