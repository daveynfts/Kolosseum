import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base'
import { dashboardAccessMessage, reportAccessMessage } from '../../lib/payments/reportAccessMessage'
export type WalletKind = 'Phantom' | 'Solflare'
const KEY = 'kolosseum.wallet.kind'
type State = { kind: WalletKind | null; address: string | null; connecting: boolean; error: string; connect: (kind: WalletKind) => Promise<void>; disconnect: () => Promise<void>; signReportAccess: (id: string) => Promise<Record<string, string>>; signDashboardAccess: () => Promise<Record<string, string>> }
export const WalletContext = createContext<State | null>(null)
export function KolosseumWalletProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<WalletKind | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const adapter = useRef<BaseMessageSignerWalletAdapter | null>(null)
  const cleanup = useRef<(() => void) | null>(null)
  const busy = useRef(false)
  const generation = useRef(0)
  const connect = useCallback(async (selected: WalletKind, eager = false) => {
    if (busy.current) return
    busy.current = true
    const ticket = ++generation.current
    setConnecting(true); setError('')
    try {
      cleanup.current?.(); await adapter.current?.disconnect(); adapter.current = null
      setAddress(null); setKind(null)
      const next = selected === 'Phantom'
        ? new (await import('@solana/wallet-adapter-phantom')).PhantomWalletAdapter()
        : new (await import('@solana/wallet-adapter-solflare')).SolflareWalletAdapter({ network: (await import('@solana/wallet-adapter-base')).WalletAdapterNetwork.Devnet })
      if (ticket !== generation.current) return
      adapter.current = next
      const onConnect = () => { if (ticket !== generation.current) return; setAddress(next.publicKey?.toBase58() || null); setKind(selected); try { sessionStorage.setItem(KEY, selected) } catch { /* optional */ } }
      const onDisconnect = () => { if (ticket !== generation.current) return; setAddress(null); setKind(null); try { sessionStorage.removeItem(KEY) } catch { /* optional */ } }
      const onError = (e: Error) => { if (!eager) setError(e.message || 'Connection declined. Please try again.') }
      next.on('connect', onConnect); next.on('disconnect', onDisconnect); next.on('error', onError)
      cleanup.current = () => { next.off('connect', onConnect); next.off('disconnect', onDisconnect); next.off('error', onError) }
      if (next.readyState === 'NotDetected' || next.readyState === 'Unsupported') { if (!eager) setError(`Install ${selected} or open this website in its mobile browser.`); return }
      if (eager) await next.autoConnect(); else await next.connect()
      if (next.publicKey) onConnect()
    } catch (e) { if (!eager && ticket === generation.current) setError(e instanceof Error ? e.message || 'Connection declined. Please try again.' : 'Could not connect.') }
    finally { if (ticket === generation.current) { busy.current = false; setConnecting(false) } }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { let saved; try { saved = sessionStorage.getItem(KEY) } catch { /* optional */ } if (saved === 'Phantom' || saved === 'Solflare') void connect(saved, true) }, 0)
    return () => { clearTimeout(timer); generation.current++; busy.current = false; cleanup.current?.() }
  }, [connect])
  async function disconnect() {
    generation.current++; busy.current = false; cleanup.current?.(); cleanup.current = null
    const previous = adapter.current; adapter.current = null
    setAddress(null); setKind(null); setConnecting(false); setError('')
    try { sessionStorage.removeItem(KEY); await previous?.disconnect() } catch { /* local disconnect complete */ }
  }
  async function sign(message: (wallet: string, at: string) => string) {
    const current = adapter.current, wallet = current?.publicKey?.toBase58()
    if (!current || !wallet) throw new Error('Connect a wallet to continue.')
    const at = new Date().toISOString()
    const signature = await current.signMessage(new TextEncoder().encode(message(wallet, at)))
    if (current !== adapter.current || wallet !== current.publicKey?.toBase58()) throw new Error('Wallet changed. Please try again.')
    const { default: bs58 } = await import('bs58')
    return { 'X-Kolosseum-Wallet': wallet, 'X-Kolosseum-Issued-At': at, 'X-Kolosseum-Signature': bs58.encode(signature) }
  }
  return <WalletContext.Provider value={{ kind, address, connecting, error, connect, disconnect, signReportAccess: id => sign((wallet, at) => reportAccessMessage(id, wallet, at)), signDashboardAccess: () => sign(dashboardAccessMessage) }}>{children}</WalletContext.Provider>
}
