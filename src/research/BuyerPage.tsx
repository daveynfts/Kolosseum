import { useEffect, useState } from 'react'
import { researchApi } from './api'
import { useKolosseumWallet } from './useKolosseumWallet'
import { WalletControls } from './WalletControls'
import './research.css'

type BuyerDashboard = {
  reports: Array<{
    id: string
    kol_ref: string
    template_slug: string | null
    content_hash: string
    payment_ref: string | null
    evidence_tx: string | null
    price_charged: string
    created_at: string
  }>
  channels: Array<{
    channel_id: string
    cap_usdc: string
    spent_usdc: string
    claimed_usdc: string
    status: string
    opened_tx: string | null
    settled_tx: string | null
    created_at: string
  }>
  votes: Array<{
    report_id: string
    value: number
    weight_usdc: string
    proof_tx: string
    created_at: string
  }>
}

function usdc(value: string): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : value
}

export function BuyerPage() {
  const wallet = useKolosseumWallet()
  const [loadedWallet, setLoadedWallet] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<BuyerDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const current = wallet.address && wallet.address === loadedWallet ? dashboard : null

  useEffect(() => { document.title = 'My research — Kolosseum' }, [])

  async function loadDashboard() {
    if (!wallet.address) return
    setLoading(true)
    setError('')
    try {
      const headers = await wallet.signDashboardAccess()
      const response = await fetch(researchApi('/me'), { headers })
      const result = await response.json() as BuyerDashboard & { error?: string }
      if (!response.ok) throw new Error(result.error || `Could not load purchases (HTTP ${response.status}).`)
      setDashboard(result)
      setLoadedWallet(wallet.address)
    } catch (cause) {
      setDashboard(null)
      setLoadedWallet(null)
      setError(cause instanceof Error ? cause.message : 'Could not load purchases.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="dr-report-page dr-me">
      <nav className="dr-report-page__nav"><a href="/scex">← Back to the KOL arena</a></nav>
      <div className="dr-panel__banner">SOLANA DEVNET / SANDBOX · BUYER RECORD</div>
      <h1>My research</h1>
      <p className="dr-report-page__meta">Sign with the wallet that paid for a report to view its purchases and recorded payment channels.</p>
      <section className="dr-verify dr-me__access">
        <WalletControls wallet={wallet} />
        <button type="button" disabled={!wallet.address || loading} onClick={() => { void loadDashboard() }}>
          {loading ? 'Checking purchases…' : current ? 'Refresh with wallet signature' : 'Show my purchases'}
        </button>
        <small>This signature does not send a transaction or spend funds.</small>
      </section>
      {error && <p className="dr-panel__error" role="alert">{error}</p>}
      {current && (
        <>
          <section className="dr-me__section">
            <h2>Reports <span>{current.reports.length}</span></h2>
            {current.reports.length === 0 ? (
              <p>No reports are recorded for this wallet. The local demo buyer uses its own sandbox wallet.</p>
            ) : (
              <div className="dr-me__list">
                {current.reports.map((report) => (
                  <article className="dr-me__item" key={report.id}>
                    <div>
                      <a href={`/reports/${report.id}`}>@{report.kol_ref} · {report.template_slug || 'Custom research'}</a>
                      <small>{new Date(report.created_at).toLocaleString('en-US')}</small>
                    </div>
                    <span>{report.payment_ref ? `Verified · $${usdc(report.price_charged)} sandbox USDC` : 'Payment proof pending'}</span>
                    <a href={`/reports/${report.id}`}>Open and verify →</a>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="dr-me__section">
            <h2>Payment channels <span>{current.channels.length}</span></h2>
            <p>These balances were recorded at the last verified payment claim and may change on-chain.</p>
            {current.channels.length === 0 ? <p>No payment channel has been verified for this wallet.</p> : (
              <div className="dr-me__list">
                {current.channels.map((channel) => (
                  <article className="dr-me__item" key={channel.channel_id}>
                    <strong>Channel {channel.channel_id.slice(0, 8)}…{channel.channel_id.slice(-8)}</strong>
                    <span className="dr-me__status">{channel.status}</span>
                    <div className="dr-me__figures">
                      <span>Cap <b>$ {usdc(channel.cap_usdc)}</b></span>
                      <span>Spent <b>$ {usdc(channel.spent_usdc)}</b></span>
                      <span>Remaining <b>$ {usdc(String(Math.max(0, Number(channel.cap_usdc) - Number(channel.spent_usdc))))}</b></span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="dr-me__section">
            <h2>Votes <span>{current.votes.length}</span></h2>
            {current.votes.length === 0 ? <p>No purchase-backed votes have been recorded.</p> : (
              <div className="dr-me__list">
                {current.votes.map((vote) => (
                  <article className="dr-me__item" key={vote.report_id}>
                    <a href={`/reports/${vote.report_id}`}>{vote.value > 0 ? '▲ Supported' : '▼ Challenged'} · report {vote.report_id.slice(0, 8)}…</a>
                    <span>Weight $ {usdc(vote.weight_usdc)} sandbox USDC</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
