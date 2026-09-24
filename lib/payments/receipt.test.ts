import { afterEach, describe, expect, it, vi } from 'vitest'
import bs58 from 'bs58'
import { inspectMppReceipt, inspectX402Receipt, parseMppReceipt, parseX402Receipt } from './receipt'
import { isNextVoucher, parseUsdc, formatUsdc } from './reconcile'

const payer = 'DXPtMmFPQbHQhrxyT4jUDqFVRdULN1q9Hpf5zKg4E1xF'
const mppPayee = 'GiyMxR1YqJSV5rEWF3tJ9SeNrGPrmpdidMe5M5jBi4Vb'
const x402Payee = '2NhkCJYpDwt9q2TgLvZYLKb7PKebxcTGUdkdbovPkdGS'
const channel = 'Gj2ZCweVQTJFetWHRBwkwvKQfSXL2jeboujKxckK8u5C'
const transaction = '24JFZRxwZpQgdFV1zpPAPAnBDPrZUx5e2EhbzYZo4KdcW7cst72En37MBEtLEeSXSYEaq1foD6zcukPXU2nt1BW4'
const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const program = 'CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX'
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const sessionBody = {
  acceptedCumulative: '450000', amount: '450000', authorized: '1000000',
  currency: mint, intent: 'session', method: 'solana', network: 'localnet',
  reference: channel, remaining: '550000', spent: '450000', status: 'success',
}
const uptoBody = {
  success: true, payer, transaction,
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', amount: '300000',
}

afterEach(() => vi.restoreAllMocks())

describe('pay.sh sandbox receipt verification', () => {
  it('rejects inconsistent MPP claims and untrusted network fields', () => {
    expect(parseMppReceipt(encode(sessionBody)).amount).toBe(450_000n)
    expect(() => parseMppReceipt(encode({ ...sessionBody, remaining: '560000' }))).toThrow()
    expect(() => parseMppReceipt(encode({ ...sessionBody, network: 'mainnet' }))).toThrow()
  })

  it('matches an MPP receipt to the on-chain channel payer, payee, cap and settled total', async () => {
    const bytes = Buffer.alloc(256)
    bytes[3] = 3
    bytes.writeBigUInt64LE(1_000_000n, 12)
    bytes.writeBigUInt64LE(450_000n, 20)
    Buffer.from(bs58.decode(payer)).copy(bytes, 88)
    Buffer.from(bs58.decode(mppPayee)).copy(bytes, 120)
    Buffer.from(bs58.decode(mint)).copy(bytes, 184)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      result: { value: { owner: program, data: [bytes.toString('base64'), 'base64'] } },
    }) })))
    const input = { receipt: encode(sessionBody), rpcUrl: 'https://sandbox.invalid', expectedPayer: payer, expectedPayee: mppPayee }
    const verified = await inspectMppReceipt(input)
    expect(verified.receiptSettledOnChain).toBe(true)
    expect(verified.remainingBaseUnits).toBe(550_000n)
    await expect(inspectMppReceipt({ ...input, expectedPayee: x402Payee })).rejects.toThrow()
  })

  it('rejects a forged x402 amount even if the transaction includes the channel program', async () => {
    expect(parseX402Receipt(encode(uptoBody)).amount).toBe(300_000n)
    const bytes = Buffer.alloc(256)
    bytes[3] = 3
    bytes.writeBigUInt64LE(1_000_000n, 12)
    bytes.writeBigUInt64LE(300_000n, 20)
    Buffer.from(bs58.decode(payer)).copy(bytes, 88)
    Buffer.from(bs58.decode(mppPayee)).copy(bytes, 120)
    Buffer.from(bs58.decode(mint)).copy(bytes, 184)
    const tx = {
      slot: 100, meta: { err: null,
        preTokenBalances: [{ accountIndex: 1, owner: x402Payee, mint, uiTokenAmount: { amount: '450000' } }],
        postTokenBalances: [{ accountIndex: 1, owner: x402Payee, mint, uiTokenAmount: { amount: '750000' } }],
      }, transaction: { message: { accountKeys: [{ pubkey: payer }, { pubkey: x402Payee }, { pubkey: channel }], instructions: [{ programId: program }] } },
    }
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      return { ok: true, json: async () => ({ result: calls % 2 === 1 ? tx : {
        value: [null, null, { owner: program, data: [bytes.toString('base64'), 'base64'] }],
      } }) }
    }))
    const input = { receipt: encode(uptoBody), rpcUrl: 'https://sandbox.invalid', expectedPayer: payer,
      expectedPayee: x402Payee, expectedChannelPayee: mppPayee }
    await expect(inspectX402Receipt(input)).resolves.toMatchObject({ amount: 300_000n, settledOnChain: true })
    await expect(inspectX402Receipt({ ...input, receipt: encode({ ...uptoBody, amount: '400000' }) })).rejects.toThrow()
    await expect(inspectX402Receipt({ ...input, expectedChannelPayee: x402Payee })).rejects.toThrow()
  })
  it('prevents overlapping cumulative vouchers on one channel', () => {
    expect(isNextVoucher(0n, 450_000n, 450_000n)).toBe(true)
    expect(isNextVoucher(450_000n, 900_000n, 450_000n)).toBe(true)
    expect(isNextVoucher(450_000n, 450_000n, 450_000n)).toBe(false)
    expect(isNextVoucher(450_000n, 450_001n, 450_000n)).toBe(false)
    expect(parseUsdc(formatUsdc(900_000n))).toBe(900_000n)
  })
})

