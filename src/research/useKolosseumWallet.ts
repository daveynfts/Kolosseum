import { useEffect, useMemo, useState } from 'react'
import bs58 from 'bs58'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { reportAccessMessage } from '../../lib/payments/reportAccessMessage'

export type KolosseumWalletKind = 'Phantom' | 'Solflare'
const STORAGE_KEY = 'kolosseum.wallet.kind'

export function useKolosseumWallet() {
  const adapters = useMemo(() => ({
    Phantom: new PhantomWalletAdapter(),
    Solflare: new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
  }), [])
  const [kind, setKind] = useState<KolosseumWalletKind | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const remembered = sessionStorage.getItem(STORAGE_KEY)
    if (remembered !== 'Phantom' && remembered !== 'Solflare') return
    let active = true
    void adapters[remembered].autoConnect().then(() => {
      const publicKey = adapters[remembered].publicKey
      if (active && publicKey) {
        setKind(remembered)
        setAddress(publicKey.toBase58())
      }
    }).catch(() => { /* User can connect explicitly. */ })
    return () => { active = false }
  }, [adapters])

  async function connect(selected: KolosseumWalletKind) {
    setConnecting(true)
    setError('')
    try {
      if (kind && kind !== selected) await adapters[kind].disconnect()
      const adapter = adapters[selected]
      await adapter.connect()
      if (!adapter.publicKey) throw new Error('Wallet did not provide a public key')
      setKind(selected)
      setAddress(adapter.publicKey.toBase58())
      sessionStorage.setItem(STORAGE_KEY, selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet connection failed')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    if (kind) await adapters[kind].disconnect()
    sessionStorage.removeItem(STORAGE_KEY)
    setKind(null)
    setAddress(null)
  }

  async function signReportAccess(reportId: string): Promise<Record<string, string>> {
    if (!kind) throw new Error('Connect a wallet to open this report')
    const adapter = adapters[kind]
    const wallet = adapter.publicKey?.toBase58()
    if (!wallet) throw new Error('Wallet is disconnected')
    const issuedAt = new Date().toISOString()
    const message = new TextEncoder().encode(reportAccessMessage(reportId, wallet, issuedAt))
    const signature = await adapter.signMessage(message)
    return {
      'X-Kolosseum-Wallet': wallet,
      'X-Kolosseum-Issued-At': issuedAt,
      'X-Kolosseum-Signature': bs58.encode(signature),
    }
  }

  return { kind, address, connecting, error, connect, disconnect, signReportAccess }
}
