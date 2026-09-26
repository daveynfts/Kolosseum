import { useContext } from 'react'
import { WalletContext } from './KolosseumWalletProvider'
export type KolosseumWalletKind = 'Phantom' | 'Solflare'
export function useKolosseumWallet() {
  const wallet = useContext(WalletContext)
  if (!wallet) throw new Error('Wallet provider is missing')
  return wallet
}
