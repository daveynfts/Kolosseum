import { useEffect, useRef, useState } from 'react'
import { useKolosseumWallet } from './useKolosseumWallet'
import { WalletButton } from './WalletButton'
import { researchApi } from './api'
import { PremiumReportBody } from './PremiumReportBody'
import { ArenaSlideshow } from './arena/ArenaSlideshow'
import { LIVE_TIERS, type LiveEffort, type LiveJobView, type LivePolicy } from '../../lib/research/liveTypes'
import './liveResearch.css'
import { AgentResearchPanel } from './AgentResearchPanel'

type Catalog = { handle: string; snapshotAt: string; sampledPosts: number; tiers: typeof LIVE_TIERS; creditUsdMicros: number }
type Operation = { id: string; jobId: string; status: string; kind: string; transaction?: string; signature?: string }
type LibraryItem = { id: string; kol_handle: string; status: string; asset: string | null }
const defaultPolicy: LivePolicy = { view: 'holders', viewers: [], allowTransfers: false }
const sol = (value: string | number) => (Number(value) / 1e9).toFixed(9).replace(/0+$/, '').replace(/\.$/, '')
async function api<T>(path: string, headers: Record<string, string> = {}, body?: unknown): Promise<T> {
  const response = await fetch(researchApi('/live' + path), { method: body === undefined ? 'GET' : 'POST', headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Live research is unavailable')
  return result
}
async function verify(job: LiveJobView) {
  if (!job.content) return
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(job.content)))
  if ([...bytes].map(b => b.toString(16).padStart(2, '0')).join('') !== job.contentHash) throw new Error('Report integrity check failed')
}
export function LiveResearchPanel({ handle, library = false }: { handle?: string; library?: boolean }) {
  const wallet = useKolosseumWallet()
  const [catalog, setCatalog] = useState<Catalog | null>(null), [job, setJob] = useState<LiveJobView | null>(null)
  const [effort, setEffort] = useState<LiveEffort>('medium'), [policy, setPolicy] = useState<LivePolicy>(defaultPolicy)
  const [viewers, setViewers] = useState(''), [recipient, setRecipient] = useState(''), [items, setItems] = useState<LibraryItem[]>([])
  const [reportId, setReportId] = useState(() => new URLSearchParams(location.search).get('report') || '')
  const [op, setOp] = useState<Operation | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [paused, setPaused] = useState(false), [now, setNow] = useState(Date.now()), [visible, setVisible] = useState(!document.hidden)
  const [reduced, setReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches)
  const auth = useRef<{ wallet: string; at: number; headers: Record<string, string> } | null>(null), lock = useRef(false)
  const scope = `${wallet.address || ''}:${handle || 'library'}`, scopeRef = useRef(scope); scopeRef.current = scope
  const refreshRef = useRef<() => Promise<void>>(async () => {})
  const openedId = useRef<string | null>(null)
  useEffect(() => { setJob(null); setOp(null); setItems([]); auth.current = null; openedId.current = null; setError(''); setPolicy(defaultPolicy); setViewers('') }, [scope])
  useEffect(() => {
    let alive = true; setCatalog(null)
    if (handle) void api<Catalog>('/catalog?handle=' + encodeURIComponent(handle)).then(value => { if (alive) setCatalog(value) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [handle])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000), media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setVisible(!document.hidden); setReduced(media.matches) }
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update) }
  }, [])
  async function headers() {
    if (!wallet.address) throw new Error('Connect a wallet to continue')
    if (auth.current?.wallet === wallet.address && Date.now() - auth.current.at < 40 * 60_000) return auth.current.headers
    const startedScope = scopeRef.current, signed = await wallet.signLiveAccess()
    if (startedScope !== scopeRef.current) throw new Error('Wallet changed')
    auth.current = { wallet: wallet.address, at: Date.now(), headers: signed }; return signed
  }
  async function accept(value: LiveJobView) {
    const startedScope = scopeRef.current
    await verify(value); if (startedScope !== scopeRef.current) return
    if (openedId.current !== value.id) { openedId.current = value.id; setPolicy(value.policy); setViewers(value.policy.viewers.join('\n')) }
    setJob(value)
    if (wallet.address === value.author) { try { localStorage.setItem(`kolosseum.live.${wallet.address}.${value.handle}`, value.id) } catch { /* library is authoritative */ } }
  }
  async function run(task: (h: Record<string, string>, startedScope: string) => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); const startedScope = scopeRef.current
    try { const h = await headers(); if (startedScope === scopeRef.current) await task(h, startedScope) }
    catch (e) { if (startedScope === scopeRef.current) setError(e instanceof Error ? e.message : 'Request failed') }
    finally { lock.current = false; setBusy(false) }
  }
  async function load(id: string, h: Record<string, string>, startedScope: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Enter a valid report ID')
    const value = await api<LiveJobView>('/reports/' + id, h)
    if (startedScope === scopeRef.current) await accept(value)
  }
  refreshRef.current = async () => {
    if (lock.current || !auth.current || auth.current.wallet !== wallet.address || Date.now() - auth.current.at > 40 * 60_000) return
    const startedScope = scopeRef.current; lock.current = true
    try {
      if (op?.status === 'submitted') { const next = await api<Operation>('/operations/' + op.id, auth.current.headers); if (startedScope === scopeRef.current) setOp(next) }
      if (job) await load(job.id, auth.current.headers, startedScope)
    } catch (e) { if (startedScope === scopeRef.current) setError(e instanceof Error ? e.message : 'Status unavailable; recover the existing report') }
    finally { lock.current = false }
  }
  const pending = !!job && ['payment_pending', 'queued', 'running'].includes(job.status)
  useEffect(() => { if (!visible || (!pending && op?.status !== 'submitted')) return; const timer = setInterval(() => void refreshRef.current(), 5000); return () => clearInterval(timer) }, [visible, pending, op?.status])
  function newQuote() { void run(async (h, s) => { const value = await api<LiveJobView>('/quotes', h, { handle, effort, policy: { ...policy, viewers: viewers.split(/[\s,]+/).filter(Boolean) } }); if (s === scopeRef.current) { setOp(null); await accept(value) } }) }
  function recover() { void run(async (h, s) => {
    if (library) { const result = await api<{ reports: LibraryItem[] }>('/library', h); if (s === scopeRef.current) setItems(result.reports); if (reportId) await load(reportId, h, s) }
    else { const result = await api<{ reports: LibraryItem[] }>('/library', h); const match = result.reports.find(r => r.kol_handle.toLowerCase() === handle?.toLowerCase()); if (match) await load(match.id, h, s); else throw new Error('No existing report for this wallet and KOL') }
  }) }
  function pay() { if (!job) return; void run(async (h, s) => {
    if (!job.transaction || Date.parse(job.quote.expiresAt) <= Date.now()) throw new Error('Quote expired. Get a new quote')
    const signed = await wallet.signNftTransaction(job.transaction, wallet.address!)
    if (s !== scopeRef.current) return
    const value = await api<LiveJobView>(`/reports/${job.id}/payment`, h, { transaction: signed })
    if (s === scopeRef.current) await accept(value)
  }) }
  function operation(kind: string, values: Record<string, unknown> = {}) { if (!job) return; void run(async (h, s) => {
    let value = await api<Operation>(`/reports/${job.id}/operations`, h, { kind, ...values })
    if (s !== scopeRef.current) return
    setOp(value)
    if (value.transaction) { const signed = await wallet.signNftTransaction(value.transaction, wallet.address!); if (s !== scopeRef.current) return; value = await api<Operation>('/operations/' + value.id, h, { transaction: signed }) }
    if (s === scopeRef.current) { setOp(value); await load(job.id, h, s) }
  }) }
  function saveViewing() { if (!job) return; void run(async (h, s) => { const value = await api<LiveJobView>(`/reports/${job.id}/viewing`, h, { policy: { ...policy, viewers: viewers.split(/[\s,]+/).filter(Boolean) } }); if (s === scopeRef.current) await accept(value) }) }
  const paymentFailed = job?.status === 'failed' && job.error === 'Payment failed on-chain; no research fee collected'
  const canQuote = !job || ['quoted', 'ready', 'refunded'].includes(job.status) || paymentFailed
  return <section className="live-research" aria-busy={busy}>
    <header><span className="premium-eyebrow">LIVE SURFAI · SOLANA DEVNET</span><h3>{library ? 'Your research & access NFTs' : `Research @${handle}`}</h3><p>New Surf research, priced in credits and paid in test SOL at the current SOL/USD rate.</p></header>
    {!wallet.address ? <WalletButton /> : <button disabled={busy} onClick={recover}>{library ? 'Sign in & load reports' : 'Recover my report'}</button>}
    {library && <><label>Open a received report NFT<input value={reportId} onChange={e => setReportId(e.target.value)} placeholder="Report ID from NFT metadata" /></label><button disabled={busy || !wallet.address || !reportId} onClick={() => void run((h, s) => load(reportId, h, s))}>Open report</button><div className="live-library">{items.map(item => <button key={item.id} disabled={busy} onClick={() => void run((h, s) => load(item.id, h, s))}>@{item.kol_handle} · {item.status}</button>)}</div></>}
    {!library && <div className="live-config"><label>Research depth<select value={effort} onChange={e => setEffort(e.target.value as LiveEffort)}>{Object.entries(LIVE_TIERS).map(([tier, credits]) => <option key={tier} value={tier}>{tier} · {credits} credits · ${(credits * 0.006).toFixed(2)}</option>)}</select></label><p>{catalog ? `${catalog.sampledPosts} source posts · snapshot ${catalog.snapshotAt}` : 'Checking source coverage…'}</p></div>}
    {(!library && !job || job?.canManage) && <fieldset><legend>{job ? 'Author controls' : 'Initial report permissions'}</legend><label>Who can read?<select value={policy.view} onChange={e => setPolicy(p => ({ ...p, view: e.target.value as LivePolicy['view'] }))}><option value="holders">Current NFT holder + author</option><option value="author">Author only</option><option value="allowlist">Invited wallets + author</option><option value="public">Everyone</option></select></label>{policy.view === 'allowlist' && <label>Invited wallet addresses<textarea value={viewers} onChange={e => setViewers(e.target.value)} placeholder="One Solana address per line (maximum 50)" /></label>}{!job && <label className="live-checkbox"><input type="checkbox" checked={policy.allowTransfers} onChange={e => setPolicy(p => ({ ...p, allowTransfers: e.target.checked }))} />Allow NFT transfers and resale</label>}{job && <><p>Current viewing policy: <b>{job.policy.view}</b></p><button disabled={busy} onClick={saveViewing}>Save viewing permissions</button></>}<small>The author retains access and can change viewing permissions or freeze NFT transfers after resale. Revocation cannot erase copies already saved by a reader. NFT ownership does not grant copyright.</small></fieldset>}
    {!library && <button className="premium-primary" disabled={busy || !wallet.address || !catalog?.sampledPosts || !canQuote} onClick={newQuote}>{job?.status === 'quoted' ? 'Refresh SOL quote' : job?.status === 'ready' ? 'Request a new report quote' : 'Get SOL quote'}</button>}
    {job && <div className="live-job"><h4>@{job.handle} · {job.status.replaceAll('_', ' ')}</h4><small>Report ID: <code>{job.id}</code></small>
      {job.status === 'quoted' && <><dl><dt>Research fee · {job.credits} credits</dt><dd>{sol(job.quote.lamports)} SOL (${(job.quote.usdMicros / 1e6).toFixed(2)})</dd><dt>SOL/USD rate</dt><dd>${(job.quote.solUsdMicros / 1e6).toFixed(2)}</dd><dt>Network fee</dt><dd>{sol(job.quote.networkFeeLamports)} SOL</dd></dl><p>Quote expires in {Math.max(0, Math.ceil((Date.parse(job.quote.expiresAt) - now) / 1000))}s. Minting is a separate wallet approval after the report is ready, with additional network/storage fees.</p><details><summary>Payment recipient</summary><code>{job.quote.recipient}</code></details><button className="premium-primary" disabled={busy || Date.parse(job.quote.expiresAt) <= now} onClick={pay}>Pay {sol(job.quote.lamports)} SOL & start research</button><small>One Surf request at the published credit price. Devnet SOL has no monetary value. Failed research is refundable; network fees are not refunded.</small></>}
      {pending && <><ArenaSlideshow paused={paused} reduced={reduced} visible={visible} /><p role="status">{job.status === 'payment_pending' ? 'Waiting for finalized Solana payment…' : job.status === 'queued' ? 'Payment finalized. Research is queued…' : `Surf is researching · ${job.eventCount} events · ${job.generatedCharacters.toLocaleString('en-US')} characters received`}</p><p>Research may take up to 30 minutes after it starts. Closing this panel does not stop the server job.</p><button onClick={() => setPaused(p => !p)}>{paused ? 'Resume slideshow' : 'Pause slideshow'}</button></>}
      {job.signature && <a target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${job.signature}?cluster=devnet`}>View research payment ↗</a>}
      {job.error && <p role="status">{job.error}</p>}{job.status === 'failed' && job.paymentKind !== 'x402-sandbox' && !paymentFailed && job.canManage && <button disabled={busy} onClick={() => operation('refund')}>Request research-fee refund</button>}
      {job.status === 'ready' && <><p>{job.sampledPosts} sources · snapshot {job.snapshotAt}</p>{job.content ? <PremiumReportBody content={job.content} /> : <p>This wallet holds the NFT but does not have viewing permission under the author's current policy.</p>}<details><summary>Report SHA-256</summary><code>{job.contentHash}</code></details>{job.canManage && !job.asset && <button disabled={busy} onClick={() => operation('mint')}>Mint my report access NFT</button>}{job.asset && <><a target="_blank" rel="noreferrer" href={`https://explorer.solana.com/address/${job.asset}?cluster=devnet`}>View report NFT ↗</a><p>Transfers/resale: {job.transfersAllowed ? 'Allowed' : 'Frozen by author'} · Current owner: <code>{job.owner}</code></p>{job.canManage && <button disabled={busy} onClick={() => operation('transfer_policy', { allowTransfers: !job.transfersAllowed })}>{job.transfersAllowed ? 'Freeze transfers & resale' : 'Allow transfers & resale'} — approve in wallet</button>}{job.owner === wallet.address && job.transfersAllowed && <><label>Transfer NFT to<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Recipient Solana wallet" /></label><button disabled={busy || !recipient} onClick={() => operation('transfer', { recipient })}>Transfer NFT — no sale payment</button><small>This transfers the NFT without collecting money. Resale can use compatible marketplaces while transfers are allowed.</small></>}</>}</>}
      {op && <p role="status">{op.kind.replaceAll('_', ' ')}: {op.status}{op.signature && <> · <a href={`https://explorer.solana.com/tx/${op.signature}?cluster=devnet`} target="_blank" rel="noreferrer">Transaction ↗</a></>}</p>}
      <button disabled={busy} onClick={() => void run((h, s) => load(job.id, h, s))}>Refresh report status</button>
    </div>}
    {!library && handle && <AgentResearchPanel handle={handle} />}
    {error && <p className="live-error" role="alert">{error}</p>}
  </section>
}
