import { useCallback, useEffect, useState } from 'react'
import { ReportMarkdown } from '../components/ReportMarkdown'
import { ADMIN_TOKEN_SESSION_KEY, researchApi } from './api'
import { WalletControls } from './WalletControls'
import { useKolosseumWallet } from './useKolosseumWallet'
import './research.css'

type Report = {
  id: string
  kolHandle: string
  templateSlug: string
  content: string
  contentHash: string
  evidenceTx: string | null
  contextAsOf: string | null
  createdAt: string
  surfModel: string
}

type Verification = {
  contentHash: string
  recomputedHashMatch: boolean
  evidenceTx: string | null
  onChainMatch: boolean | null
  networkError: boolean
  explorerUrl: string | null
}

export function ReportPage() {
  const id = window.location.pathname.split('/').filter(Boolean)[1] || ''
  const wallet = useKolosseumWallet()
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
  const [report, setReport] = useState<Report | null>(null)
  const [verify, setVerify] = useState<Verification | null>(null)
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
    if (verifyResponse.ok) setVerify(await verifyResponse.json() as Verification)
    if (!reportResponse.ok) {
      setReport(null)
      setError(reportResponse.status === 401 ? 'Connect the report owner wallet and sign, or enter the M1 admin token.' : `Could not load report (HTTP ${reportResponse.status}).`)
      return
    }
    setReport(await reportResponse.json() as Report)
  }, [id])

  useEffect(() => { void load(sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '').catch(() => setError('Report service is unavailable.')) }, [load])

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

  return (
    <main className="dr-report-page">
      <nav className="dr-report-page__nav"><a href="/scex">← Back to the KOL arena</a></nav>
      <div className="dr-panel__banner">SOLANA DEVNET · RESEARCH REPORT</div>
      <h1>{report ? `Profile @${report.kolHandle}` : 'Deep Research report'}</h1>
      {report && <p className="dr-report-page__meta">{report.templateSlug} · SCEX source as of {report.contextAsOf || 'unknown'} · Created {new Date(report.createdAt).toLocaleString('en-US')} · {report.surfModel}</p>}
      {verify && (
        <section className="dr-verify" aria-label="Report verification">
          <strong>{verify.recomputedHashMatch ? '✓ Content hash matches' : '⚠ Content hash mismatch'}</strong>
          <code>SHA-256: {verify.contentHash}</code>
          {verify.evidenceTx && verify.explorerUrl ? (
            <a href={verify.explorerUrl} target="_blank" rel="noreferrer">
              {verify.onChainMatch === true ? '✓ Devnet memo verified ↗' : verify.networkError ? 'Devnet memo: network unavailable ↗' : 'Devnet memo not verified ↗'}
            </a>
          ) : <span>Devnet memo pending.</span>}
        </section>
      )}
      {error && <p className="dr-panel__error" role="alert">{error}</p>}
      {!report && (
        <div className="dr-report-page__unlock">
          <WalletControls wallet={wallet} />
          <button type="button" disabled={!wallet.address} onClick={() => { void unlockWithWallet() }}>Open with wallet</button>
          <label>ADMIN_TOKEN (demo M1)
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
          </label>
          <button type="button" onClick={unlock}>Open report</button>
        </div>
      )}
      {report && <article className="dr-report-page__content"><ReportMarkdown text={report.content} /></article>}
    </main>
  )
}
