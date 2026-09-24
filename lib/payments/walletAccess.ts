import { createPublicKey, verify } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import { reportAccessMessage } from './reportAccessMessage'
export { reportAccessMessage } from './reportAccessMessage'

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const ACCESS_WINDOW_MS = 2 * 60 * 1000

export function parseBuyerWallet(value: unknown): string {
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) {
    throw new Error('Valid buyerWallet is required')
  }
  try {
    const bytes = bs58.decode(value)
    if (bytes.length !== 32 || bs58.encode(bytes) !== value || !PublicKey.isOnCurve(bytes)) {
      throw new Error('Invalid public key')
    }
    return value
  } catch {
    throw new Error('Valid buyerWallet is required')
  }
}

export function verifyReportAccess(
  headers: IncomingHttpHeaders,
  reportId: string,
  buyerWallet: string | null,
  now = Date.now(),
): boolean {
  if (!buyerWallet) return false
  const wallet = headers['x-kolosseum-wallet']
  const issuedAt = headers['x-kolosseum-issued-at']
  const signature = headers['x-kolosseum-signature']
  if (typeof wallet !== 'string' || wallet !== buyerWallet ||
      typeof issuedAt !== 'string' || typeof signature !== 'string') return false
  const issuedMs = Date.parse(issuedAt)
  if (!Number.isFinite(issuedMs) || new Date(issuedMs).toISOString() !== issuedAt ||
      Math.abs(now - issuedMs) > ACCESS_WINDOW_MS) return false
  try {
    const publicBytes = bs58.decode(parseBuyerWallet(wallet))
    const signatureBytes = bs58.decode(signature)
    if (signatureBytes.length !== 64) return false
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicBytes)]),
      format: 'der', type: 'spki',
    })
    return verify(null, Buffer.from(reportAccessMessage(reportId, wallet, issuedAt), 'utf8'), key, signatureBytes)
  } catch {
    return false
  }
}
