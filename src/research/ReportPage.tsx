import { useCallback, useEffect, useState } from 'react'
import { ReportMarkdown } from '../components/ReportMarkdown'
import { ADMIN_TOKEN_SESSION_KEY, researchApi } from './api'
import { WalletControls } from './WalletControls'
import { useKolosseumWallet } from './useKolosseumWallet'
import './research.css'

type Report = {
  id: string
  kolHandle: string
  templateSlug: string | null
  content: string
  contentHash: string
  evidenceTx: string | null
  contextAsOf: string | null
  createdAt: string
  surfModel: string
  paymentRef: string | null
  priceChargedUsdc: string
  buyerWallet: string | null
}

type Verification = {
  templateSlug: string | null
  contentHash: string
  recomputedHashMatch: boolean
  evidenceTx: string | null
  onChainMatch: boolean | null
  networkError: boolean
  explorerUrl: string | null
  paymentRequired: boolean
  paymentVerified: boolean
  priceChargedUsdc: string
  votes: { up: number; down: number; supportUsdc: string; challengeUsdc: string }
}

export function ReportPage() {
  const id = window.location.pathname.split('/').filter(Boolean)[1] || ''
  const wallet = useKolosseumWallet()
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
  const [report, setReport] = useState<Report | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [receipt, setReceipt] = useState('')
  const [claimState, setClaimState] = useState('')
  const [claimBusy, setClaimBusy] = useState(false)
  const [voteBusy, setVoteBusy] = useState(false)
  const [voteStatus, setVoteStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = report ? `Profile @${report.kolHandle} — Kolosseum` : 'Deep Research — Kolosseum'
  }, [report])

  const load = useCallback(async (adminToken: string, walletHeaders?: Record<string, string>) => {
    setError('')
    const [reportResponse, verifyResponse] = await Promise.all([
      fetch(researchApi(`/reports/${id}`), { headers: walletHeaders || (adminToken ? { Authorization: `Bearer ${adminToken}` } : {}) }),
      fetch(researchApi(`/reports/${id}/verify`)),
    ])
    if (verifyResponse.ok) setVerification(await verifyResponse.json() as Verification)
    if (!reportResponse.ok) {
      setReport(null)
      setError(reportResponse.status === 401
        ? 'Connect the report owner wallet and sign, or enter the private-preview admin token.'
        : reportResponse.status === 402
          ? 'Attach a settled sandbox payment receipt to reopen this report.'
          : `Could not load report (HTTP ${reportResponse.status}).`)
      return
    }
    setReport(await reportResponse.json() as Report)
  }, [id])

  useEffect(() => {
    void load(sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
      .catch(() => setError('Report service is unavailable.'))
  }, [load])

  function unlock() {
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token.trim())
    void load(token.trim()).catch(() => setError('Report service is unavailable.'))
  }

  async function unlockWithWallet() {
    try {
      const headers = await wallet.signReportAccess(id)
      await load('', headers)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign with wallet.')
    }
  }

  async function attachReceipt() {
    if (!verification || !receipt.trim()) return
    setClaimBusy(true)
    setClaimState('')
    setError('')
    try {
      const adminToken = wallet.address ? '' : token.trim()
      const headers = wallet.address
        ? await wallet.signReportAccess(id)
        : { Authorization: `Bearer ${adminToken}` }
      const response = await fetch(researchApi(`/reports/${id}/payment`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: verification.templateSlug ? 'mpp-session' : 'x402-upto',
          receipt: receipt.trim(),
        }),
      })
      const result = await response.json() as {
        error?: string
        priceChargedUsdc?: string
        channel?: { status: string; spentUsdc: string; remainingUsdc: string } | null
      }
      if (response.status === 202) {
        setClaimState('Channel settlement is pending. Wait a few seconds, then verify again.')
      } else if (!response.ok) {
        setError(result.error || `Payment verification failed (HTTP ${response.status}).`)
      } else {
        setReceipt('')
        setClaimState(`Payment verified: $${result.priceChargedUsdc} sandbox USDC.` +
          (result.channel ? ` Channel ${result.channel.status}; spent $${result.channel.spentUsdc}, remaining $${result.channel.remainingUsdc}.` : ''))
        await load(adminToken, adminToken ? undefined : headers)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify payment receipt.')
    } finally {
      setClaimBusy(false)
    }
  }

  async function submitVote(value: 1 | -1) {
    if (!report || !wallet.address || wallet.address !== report.buyerWallet) return
    setVoteBusy(true)
    setVoteStatus('')
    setError('')
    try {
      const headers = await wallet.signReportAccess(id)
      const response = await fetch(researchApi(`/reports/${id}/vote`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      const result = await response.json() as { error?: string; summary?: Verification['votes'] }
      if (!response.ok) throw new Error(result.error || `Vote failed (HTTP ${response.status}).`)
      if (result.summary) setVerification((previous) => previous ? { ...previous, votes: result.summary! } : previous)
      setVoteStatus(value === 1 ? 'Support vote recorded with your verified purchase.' : 'Challenge vote recorded with your verified purchase.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record vote.')
    } finally {
      setVoteBusy(false)
    }
  }

  return (
    <main className="dr-report-page">
      <nav className="dr-report-page__nav"><a href="/scex">← Back to the KOL arena</a></nav>
      <div className="dr-panel__banner">SOLANA DEVNET / SANDBOX · RESEARCH REPORT</div>
      <h1>{report ? `Profile @${report.kolHandle}` : 'Deep Research report'}</h1>
      {report && <p className="dr-report-page__meta">{report.templateSlug || 'Custom research'} · SCEX source as of {report.contextAsOf || 'unknown'} · Created {new Date(report.createdAt).toLocaleString('en-US')} · {report.surfModel}</p>}
      {verification && (
        <section className="dr-verify" aria-label="Report verification">
          <strong>{verification.recomputedHashMatch ? '✓ Content hash matches' : '⚠ Content hash mismatch'}</strong>
          <code>SHA-256: {verification.contentHash}</code>
          {verification.paymentRequired && <span>{verification.paymentVerified ? `✓ Payment verified · $${verification.priceChargedUsdc} sandbox USDC` : 'Payment proof pending'}</span>}
          {verification.evidenceTx && verification.explorerUrl ? (
            <a href={verification.explorerUrl} target="_blank" rel="noreferrer">
              {verification.onChainMatch === true ? '✓ Devnet memo verified ↗' : verification.networkError ? 'Devnet memo: network unavailable ↗' : 'Devnet memo not verified ↗'}
            </a>
          ) : <span>Devnet memo pending.</span>}
        </section>
      )}
      {error && <p className="dr-panel__error" role="alert">{error}</p>}
      {claimState && <p className="dr-report-page__meta" role="status">{claimState}</p>}
      {!report && (
        <div className="dr-report-page__unlock">
          <WalletControls wallet={wallet} />
          <button type="button" disabled={!wallet.address} onClick={() => { void unlockWithWallet() }}>Open with wallet</button>
          <label>ADMIN_TOKEN (private preview)
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
          </label>
          <button type="button" onClick={unlock}>Open report</button>
        </div>
      )}
      {verification?.paymentRequired && !verification.paymentVerified && (
        <section className="dr-verify dr-payment-claim" aria-label="Attach sandbox payment receipt">
          <strong>Attach sandbox payment proof</strong>
          <p>Paste the Payment-Receipt or PAYMENT-RESPONSE header value returned by pay.sh after buying this report.</p>
          <label>Receipt value
            <input value={receipt} onChange={(event) => setReceipt(event.target.value)} autoComplete="off" />
          </label>
          <button type="button" disabled={claimBusy || !receipt.trim() || (!wallet.address && !token.trim())} onClick={() => { void attachReceipt() }}>Verify payment on Solana sandbox</button>
        </section>
      )}
      {verification?.paymentRequired && (
        <section className="dr-verify dr-votes" aria-label="Purchase-backed reputation">
          <strong>Purchase-backed reputation</strong>
          <p>Support: {verification.votes.up} votes · ${verification.votes.supportUsdc} sandbox USDC weight<br />
            Challenge: {verification.votes.down} votes · ${verification.votes.challengeUsdc} sandbox USDC weight</p>
          {report && wallet.address === report.buyerWallet && verification.paymentVerified && (
            <div className="dr-votes__actions">
              <button type="button" disabled={voteBusy} onClick={() => { void submitVote(1) }}>▲ Support</button>
              <button type="button" disabled={voteBusy} onClick={() => { void submitVote(-1) }}>▼ Challenge</button>
            </div>
          )}
          {voteStatus && <small role="status">{voteStatus}</small>}
          <small>Only the verified report buyer can vote. Weight equals this report's settled sandbox purchase price.</small>
        </section>
      )}
      {report && <article className="dr-report-page__content"><ReportMarkdown text={report.content} /></article>}
    </main>
  )
}
