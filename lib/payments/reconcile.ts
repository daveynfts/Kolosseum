import { readFileSync } from 'node:fs'
import { Keypair } from '@solana/web3.js'
import type { StoredReport } from '../research/db'
import { inspectMppReceipt, inspectX402Receipt } from './receipt'

const MICRO_USDC = 1_000_000n
export function formatUsdc(baseUnits: bigint): string {
  return `${baseUnits / MICRO_USDC}.${(baseUnits % MICRO_USDC).toString().padStart(6, '0')}`
}

export function parseUsdc(value: string): bigint {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/.exec(value)
  if (!match) throw new Error('Invalid USDC amount')
  return BigInt(match[1]) * MICRO_USDC + BigInt((match[2] || '').padEnd(6, '0'))
}

export function isNextVoucher(prior: bigint, cumulative: bigint, amount: bigint): boolean {
  return amount > 0n && cumulative > prior && cumulative - prior === amount
}

export function expectedCharge(report: StoredReport): bigint {
  if (report.template_slug !== null) return 450_000n
  const credits = report.surf_usage?.creditsUsed
  if (typeof credits !== 'number' || !Number.isFinite(credits) || credits < 0) {
    throw new Error('Surf credits unavailable for payment verification')
  }
  const metered = Math.round(credits * 6_000)
  return BigInt(Math.max(100_000, Math.min(1_000_000, metered)))
}

function payoutWallet(): string {
  const path = process.env.OPERATOR_KEYPAIR_PATH
  if (!path) throw new Error('OPERATOR_KEYPAIR_PATH is not configured')
  const bytes = JSON.parse(readFileSync(path, 'utf8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(bytes)).publicKey.toBase58()
}

export type PaymentClaim =
  | { protocol: 'mpp-session'; receipt: string }
  | { protocol: 'x402-upto'; receipt: string }

export type PaymentVerification = {
  protocol: PaymentClaim['protocol']
  paymentRef: string
  amountBaseUnits: bigint
  payer: string
  settled: boolean
  channel?: {
    id: string
    capBaseUnits: bigint
    spentBaseUnits: bigint
    claimedCumulativeBaseUnits: bigint
    remainingBaseUnits: bigint
    status: 'open' | 'settled' | 'closed'
  }
}

export async function verifyPaymentForReport(
  report: StoredReport,
  claim: PaymentClaim,
): Promise<PaymentVerification> {
  if (!report.buyer_wallet) throw new Error('Report has no buyer wallet')
  const rpcUrl = process.env.PAY_SANDBOX_RPC_URL || 'https://402.surfnet.dev:8899'
  const expected = expectedCharge(report)
  if (report.template_slug !== null) {
    if (claim.protocol !== 'mpp-session') throw new Error('Quick report requires an MPP session receipt')
    const payee = process.env.PAY_GATEWAY_SIGNER_WALLET
    if (!payee) throw new Error('PAY_GATEWAY_SIGNER_WALLET is not configured')
    const channel = await inspectMppReceipt({
      receipt: claim.receipt, rpcUrl,
      expectedPayer: report.buyer_wallet, expectedPayee: payee,
    })
    if (channel.receiptAmountBaseUnits !== expected) throw new Error('MPP report price mismatch')
    return {
      protocol: claim.protocol,
      paymentRef: `mpp:${channel.channelId}:${channel.receiptSpentBaseUnits}`,
      amountBaseUnits: channel.receiptAmountBaseUnits,
      payer: channel.payer,
      settled: channel.receiptSettledOnChain,
      channel: {
        id: channel.channelId,
        capBaseUnits: channel.capBaseUnits,
        spentBaseUnits: channel.settledBaseUnits,
        claimedCumulativeBaseUnits: channel.receiptSpentBaseUnits,
        remainingBaseUnits: channel.remainingBaseUnits,
        status: channel.status === 'distributed' ? 'closed' :
          channel.status === 'open' ? 'open' : 'settled',
      },
    }
  }
  if (claim.protocol !== 'x402-upto') throw new Error('Deep report requires an x402 upto receipt')
  const receipt = await inspectX402Receipt({
    receipt: claim.receipt, rpcUrl,
    expectedPayer: report.buyer_wallet, expectedPayee: payoutWallet(),
    expectedChannelPayee: process.env.PAY_GATEWAY_SIGNER_WALLET || '',
  })
  if (receipt.amount !== expected) throw new Error('x402 metered price mismatch')
  return {
    protocol: claim.protocol,
    paymentRef: `x402:${receipt.transaction}`,
    amountBaseUnits: receipt.amount,
    payer: receipt.payer,
    settled: true,
  }
}
