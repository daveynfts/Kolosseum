import type { useKolosseumWallet } from './useKolosseumWallet'

type WalletState = ReturnType<typeof useKolosseumWallet>

export function WalletControls({ wallet }: { wallet: WalletState }) {
  return (
    <div className="dr-wallet" aria-label="Solana wallet">
      {wallet.address ? (
        <>
          <span>Connected: {wallet.kind} · {wallet.address.slice(0, 5)}…{wallet.address.slice(-5)}</span>
          <button type="button" onClick={() => { void wallet.disconnect() }}>Disconnect</button>
        </>
      ) : (
        <>
          <button type="button" disabled={wallet.connecting} onClick={() => { void wallet.connect('Phantom') }}>Connect Phantom</button>
          <button type="button" disabled={wallet.connecting} onClick={() => { void wallet.connect('Solflare') }}>Connect Solflare</button>
        </>
      )}
      {wallet.error && <span className="dr-panel__error" role="alert">{wallet.error}</span>}
    </div>
  )
}
