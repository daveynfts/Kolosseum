import { useEffect, useState, type FormEvent } from 'react'
import { ADMIN_TOKEN_SESSION_KEY, researchApi } from './api'
import './research.css'

type Template = {
  slug: string
  title: string
  description: string
  price_usdc: string
  price_usdc_cached: string
}

export function DeepResearchPanel({ kolHandle }: { kolHandle: string }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateSlug, setTemplateSlug] = useState('risk-profile')
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    void fetch(researchApi('/templates'), { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Research service is unavailable (HTTP ${response.status}).`)
        return response.json() as Promise<{ templates: Template[] }>
      })
      .then((data) => { if (!cancelled) setTemplates(data.templates) })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load report templates.') })
    return () => { cancelled = true }
  }, [])

  const selected = templates.find((template) => template.slug === templateSlug)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token.trim()) { setError('Enter ADMIN_TOKEN to run the private M1 demo.'); return }
    setLoading(true)
    setError('')
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token.trim())
    try {
      const response = await fetch(researchApi('/research/quick'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({ kolHandle, templateSlug }),
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

  return (
    <form className="dr-panel" onSubmit={submit}>
      <div className="dr-panel__banner">SOLANA DEVNET · M1 PRIVATE DEMO · NO PAYMENT</div>
      <h3>Deep Research: @{kolHandle}</h3>
      <p>Generate a research report from current SCEX/KOL data with the live Surf AI API. The report records source posts and timestamps.</p>
      <label>
        Report template
        <select value={templateSlug} onChange={(event) => setTemplateSlug(event.target.value)} disabled={!templates.length || loading}>
          {templates.map((template) => <option key={template.slug} value={template.slug}>{template.title}</option>)}
        </select>
      </label>
      {selected && <p className="dr-panel__quote">{selected.description}<br />Planned M2 price: {selected.price_usdc} USDC · M1: 0 USDC.</p>}
      <label>
        ADMIN_TOKEN (M1 demo only)
        <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
      </label>
      {error && <p className="dr-panel__error" role="alert">{error}</p>}
      <button type="submit" disabled={loading || !selected}>{loading ? 'Generating with Surf AI…' : 'Generate report'}</button>
      <small>For research only, not investment advice. Wallet payments are planned for M2.</small>
    </form>
  )
}
