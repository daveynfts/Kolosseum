import { useEffect, useState, type FormEvent } from 'react'
import { ADMIN_TOKEN_SESSION_KEY, researchApi } from './api'
import { useKolosseumWallet } from './useKolosseumWallet'
import { WalletControls } from './WalletControls'
import './research.css'

type Template = {
  slug: string
  title: string
  description: string
  price_usdc: string
  price_usdc_cached: string
}

type Health = {
  enabled: boolean
  gatewayMode: boolean
  surfConfigured: boolean
  databaseConfigured: boolean
}

type Channel = {
  channel_id: string
  cap_usdc: string
  spent_usdc: string
  status: string
}

export function DeepResearchPanel({ kolHandle }: { kolHandle: string }) {
  const wallet = useKolosseumWallet()
  const [health, setHealth] = useState<Health | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateSlug, setTemplateSlug] = useState('risk-profile')
  const [mode, setMode] = useState<'quick' | 'deep'>('quick')
  const [prompt, setPrompt] = useState('')
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
  const [channel, setChannel] = useState<{ wallet: string; record: Channel } | null>(null)
  const [channelBusy, setChannelBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [channelError, setChannelError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(researchApi('/health'))
      .then(async (response) => {
        if (!response.ok) throw new Error('Research service is unavailable.')
        return response.json() as Promise<Health>
      })
      .then((result) => { if (!cancelled) setHealth(result) })
      .catch(() => { if (!cancelled) setError('Research service is unavailable.') })
    void fetch(researchApi('/templates'))
      .then(async (response) => {
        if (!response.ok) throw new Error('Report templates are unavailable until the database is configured.')
        return response.json() as Promise<{ templates: Template[] }>
      })
      .then((result) => { if (!cancelled) setTemplates(result.templates) })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load report templates.') })
    return () => { cancelled = true }
  }, [])

  const selected = templates.find((template) => template.slug === templateSlug)
  const ready = Boolean(health?.enabled && health.surfConfigured && health.databaseConfigured)
  const gateway = Boolean(health?.gatewayMode)
  const currentChannel = channel?.wallet === wallet.address ? channel.record : null
  const validPrompt = prompt.trim().length >= 20 && prompt.trim().length <= 2_000
  const demoCommand = mode === 'quick'
    ? `npm run pay:demo-buy -- -KolHandle ${kolHandle} -TemplateSlug ${templateSlug}`
    : `npm run pay:demo-buy -- -KolHandle ${kolHandle} -Prompt '${prompt.trim().replace(/'/g, "''")}'`

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (gateway) return
    if (!token.trim()) { setError('Enter ADMIN_TOKEN for the private research preview.'); return }
    if (mode === 'deep' && !validPrompt) { setError('The custom prompt must be 20–2,000 characters.'); return }
    setLoading(true)
    setError('')
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token.trim())
    try {
      const response = await fetch(researchApi(mode === 'quick' ? '/research/quick' : '/research/deep'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify(mode === 'quick' ? { kolHandle, templateSlug } : { kolHandle, prompt: prompt.trim() }),
      })
      const data = await response.json() as { reportId?: string; error?: string }
      if (!response.ok || !data.reportId) throw new Error(data.error || `Research HTTP ${response.status}`)
      window.location.assign(`/reports/${data.reportId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate the report.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshChannel() {
    if (!wallet.address) return
    setChannelBusy(true)
    setChannelError('')
    try {
      const headers = await wallet.signDashboardAccess()
      const response = await fetch(researchApi('/me'), { headers })
      const data = await response.json() as { channels?: Channel[]; error?: string }
      if (!response.ok) throw new Error(data.error || `Could not load channel (HTTP ${response.status}).`)
      const latest = data.channels?.[0] || null
      setChannel(latest ? { wallet: wallet.address, record: latest } : null)
      if (!latest) setChannelError('No payment channel has been verified for this wallet.')
    } catch (cause) {
      setChannel(null)
      setChannelError(cause instanceof Error ? cause.message : 'Could not load channel.')
    } finally {
      setChannelBusy(false)
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(demoCommand)
      setCopied(true)
    } catch {
      setError('Copy failed. Select the command below manually.')
    }
  }

  return (
    <form className="dr-panel" onSubmit={submit}>
      <div className="dr-panel__banner">SOLANA DEVNET / SANDBOX · NO REAL FUNDS</div>
      <h3>Deep Research: @{kolHandle}</h3>
      <p>Research from live KOL and SCEX posts, with Surf AI analysis, a content hash, and a devnet Memo.</p>
      {error && <p className="dr-panel__error" role="alert">{error}</p>}
      <div className="dr-panel__modes" role="group" aria-label="Research type">
        <button type="button" className={mode === 'quick' ? 'is-active' : ''} onClick={() => { setMode('quick'); setCopied(false) }}>Template report</button>
        <button type="button" className={mode === 'deep' ? 'is-active' : ''} onClick={() => { setMode('deep'); setCopied(false) }}>Custom research</button>
      </div>
      {mode === 'quick' ? (
        <label>
          Report template
          <select value={templateSlug} onChange={(event) => { setTemplateSlug(event.target.value); setCopied(false) }} disabled={!templates.length || loading}>
            {templates.length === 0 && <option value="risk-profile">Templates available after database setup</option>}
            {templates.map((template) => <option key={template.slug} value={template.slug}>{template.title}</option>)}
          </select>
        </label>
      ) : (
        <label>
          Research question
          <textarea value={prompt} maxLength={2000} rows={4} onChange={(event) => { setPrompt(event.target.value); setCopied(false) }}
            placeholder="Which public claims about this KOL are supported by dated sources?" />
          <small>{prompt.trim().length}/2,000 characters · minimum 20</small>
        </label>
      )}
      {mode === 'quick' && selected && <p className="dr-panel__quote">{selected.description}<br />Sandbox price: ${selected.price_usdc} USDC per report.</p>}
      {mode === 'deep' && <p className="dr-panel__quote">Authorize up to $1.00 sandbox USDC. Actual charge follows Surf credits used at $0.006 per credit, with a $0.10 minimum.</p>}
      <div className="dr-panel__wallet">
        <WalletControls wallet={wallet} />
        <div className="dr-panel__wallet-actions">
          <button type="button" disabled={!wallet.address || channelBusy} onClick={() => { void refreshChannel() }}>
            {channelBusy ? 'Checking channel…' : 'Check recorded channel'}
          </button>
          <a href="/me">My research →</a>
        </div>
        {currentChannel && <small>Last verified channel: {currentChannel.status} · cap ${currentChannel.cap_usdc}, spent ${currentChannel.spent_usdc} sandbox USDC. <a href="/me">Details</a></small>}
        {channelError && <small className="dr-panel__error" role="status">{channelError}</small>}
      </div>
      {!ready && <p className="dr-panel__notice" role="status">Live generation is waiting for {[
        !health?.surfConfigured && 'SURF_API_KEY',
        !health?.databaseConfigured && 'DATABASE_URL',
      ].filter(Boolean).join(' and ') || 'the research service'}.</p>}
      {gateway ? (
        <div className="dr-panel__demo">
          <strong>Sandbox purchase via local demo buyer</strong>
          <p>The pay.sh CLI pays from its own sandbox wallet, verifies the receipt, then checks the devnet Memo. A connected Phantom or Solflare wallet does not pay for this CLI purchase.</p>
          <code>{demoCommand}</code>
          <button type="button" disabled={!ready || (mode === 'quick' ? !selected : !validPrompt)} onClick={() => { void copyCommand() }}>
            {copied ? 'Command copied' : 'Copy demo command'}
          </button>
        </div>
      ) : (
        <>
          <label>
            ADMIN_TOKEN (private preview)
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
          </label>
          <button type="submit" disabled={loading || !ready || (mode === 'quick' ? !selected : !validPrompt)}>
            {loading ? 'Generating with Surf AI…' : 'Generate private preview'}
          </button>
          <small>Payment gateway is off. Private previews do not charge sandbox USDC.</small>
        </>
      )}
      <small>Research only. No investment advice or buy/sell recommendations.</small>
    </form>
  )
}
