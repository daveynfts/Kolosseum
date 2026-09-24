import { generateKeyPairSync } from 'node:crypto'
import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { parseDemoBuyerResult, purchasedReportId } from './demoBuy'

const reportId = 'e92da370-50a7-4875-9191-5dc0e6916df0'
const wallet = bs58.encode(generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32))
const signature = bs58.encode(Buffer.alloc(64, 7))
const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`

function output(overrides: Record<string, unknown> = {}) {
  const result = {
    reportId, buyerWallet: wallet, protocol: 'x402-upto',
    priceChargedUsdc: '0.300000', explorerUrl, ...overrides,
  }
  return `Purchased report ${reportId} for @example with sandbox x402-upto.\nDEMO_RESULT_JSON:${JSON.stringify(result)}\n`
}

describe('local sandbox buyer result', () => {
  it('reads the verified result without trusting surrounding CLI text', () => {
    expect(parseDemoBuyerResult('untrusted CLI text\n' + output())).toEqual({
      reportId, buyerWallet: wallet, protocol: 'x402-upto',
      priceChargedUsdc: '0.300000', explorerUrl,
    })
    expect(purchasedReportId(output())).toBe(reportId)
  })

  it('rejects unverified network, wallet, price, and missing completion markers', () => {
    expect(() => parseDemoBuyerResult(output({ explorerUrl: explorerUrl.replace('devnet', 'mainnet') }))).toThrow()
    expect(() => parseDemoBuyerResult(output({ buyerWallet: bs58.encode(Buffer.alloc(31)) }))).toThrow()
    expect(() => parseDemoBuyerResult(output({ priceChargedUsdc: '-1' }))).toThrow()
    expect(() => parseDemoBuyerResult(output({ protocol: 'mainnet-transfer' }))).toThrow()
    expect(() => parseDemoBuyerResult(`Purchased report ${reportId} for @example\n`)).toThrow()
    expect(purchasedReportId('purchase failed before report creation')).toBeNull()
  })
})
