import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useKolosseumWallet } from './useKolosseumWallet'
import { useDialogFocus } from '../lib/useDialogFocus'
export function WalletButton() {
  const wallet = useKolosseumWallet(), [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  useDialogFocus(panel, open)
  useEffect(() => { if (wallet.address) setOpen(false) }, [wallet.address])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setOpen(false) } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [open])
  return <>
    <button className="premium-wallet-button" onClick={() => setOpen(true)}>{wallet.address ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : wallet.connecting ? 'Connecting…' : 'Connect wallet'}</button>
    {open && createPortal(<div className="premium-wallet-scrim" onClick={() => setOpen(false)}><div ref={panel} className="premium-wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="wallet-title" data-wallet-dialog onClick={e => e.stopPropagation()}>
      <button className="premium-close" aria-label="Close wallet picker" onClick={() => setOpen(false)}>×</button>
      <span className="premium-eyebrow">YOUR SEAT IN THE ARENA</span><h2 id="wallet-title">Connect your wallet</h2><p>Explore the Solana Devnet experience. This demo requests no signature or payment.</p>
      {wallet.address ? <><code>{wallet.address}</code><button onClick={() => { void wallet.disconnect() }}>Disconnect {wallet.kind}</button></> : <div className="premium-wallet-options">{(['Phantom', 'Solflare'] as const).map(kind => <button key={kind} disabled={wallet.connecting} onClick={() => { void wallet.connect(kind) }}><span className={`wallet-symbol wallet-symbol--${kind.toLowerCase()}`}>{kind === 'Phantom' ? '◉' : '☀'}</span>{kind}<span>↗</span></button>)}</div>}
      {wallet.error && <p role="alert" className="premium-error">{wallet.error}</p>}<small>On mobile, open this website inside your wallet's browser.</small><a href="https://docs.phantom.com/developer-powertools/testnet-mode" target="_blank" rel="noreferrer">How to enable testnet mode ↗</a>
    </div></div>, document.body)}
  </>
}
