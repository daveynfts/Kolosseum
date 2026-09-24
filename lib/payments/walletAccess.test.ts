import { generateKeyPairSync, sign } from 'node:crypto'
import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { dashboardAccessMessage, parseBuyerWallet, reportAccessMessage, verifyDashboardAccess, verifyReportAccess } from './walletAccess'

function signedAccess(reportId: string, issuedAt: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const wallet = bs58.encode(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32))
  const message = Buffer.from(reportAccessMessage(reportId, wallet, issuedAt), 'utf8')
  const signature = bs58.encode(sign(null, message, privateKey))
  return {
    wallet,
    headers: {
      'x-kolosseum-wallet': wallet,
      'x-kolosseum-issued-at': issuedAt,
      'x-kolosseum-signature': signature,
    },
  }
}

describe('buyer wallet access', () => {
  it('accepts a current Ed25519 signature for the owned report only', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z')
    const id = 'e92da370-50a7-4875-9191-5dc0e6916df0'
    const { wallet, headers } = signedAccess(id, new Date(now).toISOString())
    expect(parseBuyerWallet(wallet)).toBe(wallet)
    expect(verifyReportAccess(headers, id, wallet, now)).toBe(true)
    expect(verifyReportAccess(headers, '140e123f-2261-4d98-82ff-bf14019326fb', wallet, now)).toBe(false)
    expect(verifyReportAccess(headers, id, null, now)).toBe(false)
    expect(verifyReportAccess(headers, id, bs58.encode(Buffer.alloc(32, 2)), now)).toBe(false)
  })

  it('keeps buyer dashboard signatures separate from report access', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z')
    const issuedAt = new Date(now).toISOString()
    const reportId = 'e92da370-50a7-4875-9191-5dc0e6916df0'
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const wallet = bs58.encode(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32))
    const headers = {
      'x-kolosseum-wallet': wallet,
      'x-kolosseum-issued-at': issuedAt,
      'x-kolosseum-signature': bs58.encode(sign(null, Buffer.from(dashboardAccessMessage(wallet, issuedAt)), privateKey)),
    }
    expect(verifyDashboardAccess(headers, now)).toBe(wallet)
    expect(verifyReportAccess(headers, reportId, wallet, now)).toBe(false)
    expect(verifyDashboardAccess(headers, now + 120_001)).toBeNull()
    expect(verifyDashboardAccess(signedAccess(reportId, issuedAt).headers, now)).toBeNull()
    expect(verifyDashboardAccess({ ...headers, 'x-kolosseum-wallet': bs58.encode(Buffer.alloc(32, 2)) }, now)).toBeNull()
  })

  it('rejects expired, malformed, and altered claims', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z')
    const id = 'e92da370-50a7-4875-9191-5dc0e6916df0'
    const { wallet, headers } = signedAccess(id, new Date(now).toISOString())
    expect(verifyReportAccess(headers, id, wallet, now + 120_001)).toBe(false)
    expect(verifyReportAccess({ ...headers, 'x-kolosseum-issued-at': 'tomorrow' }, id, wallet, now)).toBe(false)
    expect(verifyReportAccess({ ...headers, 'x-kolosseum-signature': bs58.encode(Buffer.alloc(64)) }, id, wallet, now)).toBe(false)
    expect(() => parseBuyerWallet('bad-wallet')).toThrow('Valid buyerWallet is required')
    expect(() => parseBuyerWallet(bs58.encode(Buffer.alloc(31)))).toThrow('Valid buyerWallet is required')
  })
})

