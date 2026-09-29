import { parseBuyerWallet } from '../payments/walletAccess'
import { LIVE_TIERS, type LiveEffort, type LivePolicy } from './liveTypes'
export function liveEffort(value: unknown): LiveEffort {
  if (typeof value !== 'string' || !Object.hasOwn(LIVE_TIERS, value)) throw new Error('Invalid research tier')
  return value as LiveEffort
}
export function livePolicy(value: unknown): LivePolicy {
  const p = value as LivePolicy | undefined
  if (!p || !['author', 'holders', 'allowlist', 'public'].includes(p.view) || typeof p.allowTransfers !== 'boolean' || !Array.isArray(p.viewers) || p.viewers.length > 50) throw new Error('Invalid report permissions')
  const viewers = [...new Set(p.viewers.map(parseBuyerWallet))]
  return { view: p.view, viewers, allowTransfers: p.allowTransfers }
}
export function canReadLive(author: string, wallet: string | null, policy: LivePolicy, currentOwner: string | null): boolean {
  if (wallet === author || policy.view === 'public') return true
  if (!wallet) return false
  return policy.view === 'allowlist' ? policy.viewers.includes(wallet) : policy.view === 'holders' && currentOwner === wallet
}
