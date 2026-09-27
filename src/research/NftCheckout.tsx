import { useEffect, useRef, useState } from 'react'
import { researchApi } from './api'
import { useKolosseumWallet } from './useKolosseumWallet'
import { WalletButton } from './WalletButton'
import { ArenaSlideshow } from './arena/ArenaSlideshow'
import { PremiumReportBody } from './PremiumReportBody'
import type { NftQuote, PremiumReport } from '../../lib/payments/reportNft'
import './nftCheckout.css'

type Purchase = { id: string; quote: NftQuote; status: 'quoted' | 'submitted' | 'confirmed' | 'failed'; signature: string | null; transaction?: string; report?: PremiumReport }
type Catalog = Omit<PremiumReport, 'content'> & { storageConfigured: boolean }
const sol = (lamports: string | number) => (Number(lamports) / 1e9).toFixed(9).replace(/0+$/, '').replace(/\.$/, '')
const explorer = (kind: 'tx' | 'address', value: string) => `https://explorer.solana.com/${kind}/${value}?cluster=devnet`
async function api<T>(path: string, headers: Record<string, string> = {}, body?: unknown): Promise<T> {
  const response = await fetch(researchApi(path), { method: body === undefined ? 'GET' : 'POST', headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'NFT checkout is unavailable')
  return result
}
async function verifyContent(report: PremiumReport) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(report.content))
  if ([...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('') !== report.contentHash) throw new Error('Report integrity check failed')
}
export function NftCheckout({ library = false, onReplay }: { library?: boolean; onReplay?: () => void }) {
  const wallet = useKolosseumWallet()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [items, setItems] = useState<Purchase[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [paused, setPaused] = useState(false), [visible, setVisible] = useState(!document.hidden)
  const [reduced, setReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [now, setNow] = useState(Date.now())
  const lock = useRef(false), account = useRef(wallet.address), auth = useRef<{ wallet: string; at: number; headers: Record<string, string> } | null>(null)
  account.current = wallet.address
  useEffect(() => { let live = true; if (!library) void api<Catalog>('/nft/catalog').then(r => { if (live) setCatalog(r) }).catch(e => { if (live) setError(e.message) }); return () => { live = false } }, [library])
  useEffect(() => { setPurchase(null); setItems([]); auth.current = null; setError('') }, [wallet.address])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000), media = matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media.matches), visibility = () => setVisible(!document.hidden)
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility)
    return () => { clearInterval(timer); media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  async function headers() {
    const buyer = wallet.address
    if (!buyer) throw new Error('Connect a wallet to continue')
    if (auth.current?.wallet === buyer && Date.now() - auth.current.at < 90_000) return auth.current.headers
    const signed = await wallet.signDashboardAccess()
    if (account.current !== buyer) throw new Error('Wallet changed')
    auth.current = { wallet: buyer, at: Date.now(), headers: signed }
    return signed
  }
  async function accept(value: Purchase, buyer: string) {
    if (value.quote.buyer !== buyer) throw new Error('Purchase wallet mismatch')
    if (value.report) { if (value.report.contentHash !== value.quote.contentHash) throw new Error('Report quote mismatch'); await verifyContent(value.report) }
    if (account.current !== buyer) return
    setPurchase(value)
    try { localStorage.setItem('kolosseum.nft.' + buyer, value.id) } catch { /* server library remains authoritative */ }
  }
  async function run(task: (buyer: string) => Promise<void>) {
    if (lock.current || !wallet.address) return
    const buyer = wallet.address; lock.current = true; setBusy(true); setError('')
    try { await task(buyer) } catch (e) { if (account.current === buyer) setError(e instanceof Error ? e.message : 'Checkout failed') } finally { lock.current = false; setBusy(false) }
  }
  async function quote() { await run(async buyer => { await accept(await api<Purchase>('/nft/quotes', await headers(), {}), buyer) }) }
  async function refresh() { if (purchase) await run(async buyer => { await accept(await api<Purchase>(`/nft/purchases/${purchase.id}`, await headers()), buyer) }) }
  async function loadLibrary() { await run(async buyer => { const result = await api<{ purchases: Purchase[] }>('/nft/purchases', await headers()); if (account.current === buyer) setItems(result.purchases); if (!library && result.purchases[0]) await accept(await api<Purchase>(`/nft/purchases/${result.purchases[0].id}`, await headers()), buyer) }) }
  async function pay() {
    if (!purchase?.transaction || purchase.status !== 'quoted') return
    await run(async buyer => {
      if (Date.parse(purchase.quote.expiresAt) <= Date.now()) throw new Error('Quote expired. Refresh the quote.')
      const access = await headers()
      const signed = await wallet.signNftTransaction(purchase.transaction!, buyer)
      // Server persists signed bytes before broadcast, allowing safe recovery after a network timeout.
      await accept(await api<Purchase>(`/nft/purchases/${purchase.id}/submit`, access, { transaction: signed }), buyer)
    })
  }
  useEffect(() => {
    if (purchase?.status !== 'submitted' || !visible || !wallet.address) return
    const timer = setInterval(() => {
      // Never trigger an unsolicited signature prompt while polling.
      if (!lock.current && auth.current?.wallet === wallet.address && Date.now() - auth.current.at < 90_000) void refresh()
    }, 3000)
    return () => clearInterval(timer)
  }, [purchase?.id, purchase?.status, visible, wallet.address])
  const current = purchase?.quote.buyer === wallet.address ? purchase : null
  if (current?.status === 'confirmed' && current.report) return <article className="surf-experience premium-report nft-checkout">
    <span className="premium-eyebrow">PURCHASE CONFIRMED · SOLANA DEVNET</span><h3>Your SurfAI report NFT</h3>
    <p>Report edition minted to your purchasing wallet. NFT transfers do not transfer this purchase history or exclusive copyright.</p>
    <div className="nft-links"><a target="_blank" rel="noreferrer" href={explorer('address', current.quote.asset)}>View NFT ↗</a><a target="_blank" rel="noreferrer" href={explorer('tx', current.signature!)}>Payment + mint ↗</a><a href="/me">My Reports →</a></div>
    <p>{current.report.model} · {current.report.effort} · {current.quote.credits} credits · {sol(current.quote.lamports)} SOL</p><p>Source snapshot: {current.report.snapshotAt} · Generated: {current.report.createdAt.slice(0, 10)}</p>
    {current.report.editorialReview && <details><summary>Source-reviewed edition · editorial changes</summary><p>{current.report.editorialReview.method}</p><ul>{current.report.editorialReview.changes.map(change => <li key={change}>{change}</li>)}</ul><p>Original Surf content SHA-256</p><code>{current.report.editorialReview.originalContentHash}</code></details>}
    <PremiumReportBody content={current.report.content} /><details><summary>Verified report SHA-256</summary><code>{current.report.contentHash}</code><p>The NFT links to a public prepared report edition. Report content is stored off-chain.</p></details>
    {library && <button onClick={() => setPurchase(null)}>Back to collection</button>}
  </article>
  return <section className="surf-experience nft-checkout" aria-busy={busy}>
    <span className="premium-eyebrow">SURFAI · METAPLEX CORE · DEVNET</span><h3>{library ? 'Report NFTs' : 'Research worth collecting.'}</h3>
    {!library && <p><a href="/demo/nbaluong-premium.html" target="_blank" rel="noreferrer">Preview the complete source-reviewed dossier ↗</a></p>}
    {!library && <><p>A prepared, maximum-depth nbaluong report. Pay with test SOL and mint your report edition in one transaction.</p><div className="nft-tier"><b>Surf 2.0 · xhigh</b><strong>{catalog ? `${catalog.credits} credits · $${(catalog.credits * catalog.creditUsdMicros / 1e6).toFixed(2)}` : 'Loading research edition…'}</strong><small>Published list price · Live SOL/USD conversion at checkout</small></div><p className="premium-caption">This purchase mints a collectible copy of an existing report. It does not make a new Surf API call. SOL Devnet has no monetary value.</p></>}
    {!wallet.address ? <WalletButton /> : <div className="nft-links">{!library && <button disabled={busy || !catalog?.storageConfigured || current?.status === 'submitted' || current?.status === 'failed'} onClick={() => void quote()}>{busy ? 'Working…' : current?.status === 'quoted' ? 'Refresh quote' : 'Get SOL quote'}</button>}<button disabled={busy} onClick={() => void loadLibrary()}>{library ? 'Load my NFTs' : 'Recover my purchase'}</button></div>}
    {!library && catalog && !catalog.storageConfigured && <p role="status">Checkout opens once public NFT metadata storage is configured. No payment can be requested yet.</p>}
    {current?.status === 'quoted' && <div className="nft-quote"><h4>Review your payment</h4><dl><dt>Report · {current.quote.credits} credits</dt><dd>{sol(current.quote.lamports)} SOL</dd><dt>Mint / rent estimate</dt><dd>Up to ~{sol(current.quote.mintCostEstimateLamports)} SOL</dd><dt>Network fee</dt><dd>{sol(current.quote.networkFeeLamports)} SOL</dd><dt>SOL/USD rate</dt><dd>${(current.quote.solUsdMicros / 1e6).toFixed(2)}</dd></dl><small>{current.quote.rateSource} · {new Date(current.quote.rateAsOf).toLocaleTimeString('en-US')} · Expires in {Math.max(0, Math.ceil((Date.parse(current.quote.expiresAt) - now) / 1000))}s</small><details><summary>Recipient and report</summary><code>{current.quote.recipient}</code><code>{current.quote.contentHash}</code></details><button className="premium-primary" disabled={busy || now >= Date.parse(current.quote.expiresAt)} onClick={() => void pay()}>Pay {sol(current.quote.lamports)} SOL + fees & mint NFT</button><small>Approve the complete transaction in your wallet. Declining does not charge the report price.</small></div>}
    {current?.status === 'submitted' && <><ArenaSlideshow paused={paused} reduced={reduced} visible={visible} /><p role="status">Confirming payment and NFT on Solana Devnet…</p><p className="premium-caption">If confirmation is delayed, check the original transaction. Do not pay again.</p><div className="nft-links"><button onClick={() => setPaused(p => !p)}>{paused ? 'Resume slideshow' : 'Pause slideshow'}</button><button disabled={busy} onClick={() => void refresh()}>Check confirmation</button><a href={explorer('tx', current.signature!)} target="_blank" rel="noreferrer">Transaction ↗</a></div></>}
    {current?.status === 'failed' && <p role="alert">The transaction failed on-chain. The report payment and NFT mint were reverted; network fees may apply. Review the transaction before starting a new purchase.</p>}
    {error && <p role="alert" className="dr-panel__error">{error}</p>}
    {library && items.map(item => <article className="nft-library-item" key={item.id}><b>nbaluong · SurfAI xhigh</b><span>{item.status} · {sol(item.quote.lamports)} SOL</span><button disabled={busy} onClick={() => void run(async buyer => { await accept(await api<Purchase>(`/nft/purchases/${item.id}`, await headers()), buyer) })}>Open purchase</button></article>)}
    {library && wallet.address && !items.length && <p className="premium-caption">Sign to load purchases recorded for this wallet.</p>}
    {onReplay && <button onClick={onReplay}>Explore the free recorded demo →</button>}
  </section>
}
