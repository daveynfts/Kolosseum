import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PaymentVerification } from '../payments/reconcile'

loadEnv({ path: '.env.local', quiet: true })

const testUrl = process.env.TEST_DATABASE_URL
if (testUrl) {
  const testAddress = new URL(testUrl)
  const appAddress = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null
  const databaseName = decodeURIComponent(testAddress.pathname.slice(1))
  const sameDatabase = appAddress &&
    testAddress.hostname === appAddress.hostname &&
    (testAddress.port || '5432') === (appAddress.port || '5432') &&
    testAddress.pathname === appAddress.pathname
  if (databaseName !== 'kolosseum_test' || sameDatabase) {
    throw new Error('Vote integration tests require a separate database named kolosseum_test')
  }
}

type Db = typeof import('./db')
let db: Db
let pool: pg.Pool
let fixtureInserted = false
const reportId = randomUUID()
const buyerWallet = 'DXPtMmFPQbHQhrxyT4jUDqFVRdULN1q9Hpf5zKg4E1xF'
const otherWallet = 'GiyMxR1YqJSV5rEWF3tJ9SeNrGPrmpdidMe5M5jBi4Vb'
const channelId = `test-channel-${reportId}`
const paymentRef = `mpp:${channelId}:450000`
const originalDatabaseUrl = process.env.DATABASE_URL

describe.skipIf(!testUrl)('purchase-backed vote against dedicated PostgreSQL', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl
    db = await import('./db')
    pool = db.getPool()
    await pool.query(readFileSync(new URL('../../dr_migrations/0001_deep_research.sql', import.meta.url), 'utf8'))
    await pool.query(
      `INSERT INTO dr_reports
       (id, kol_ref, prompt_hash, content_encrypted, content_hash, buyer_wallet, surf_model)
       VALUES ($1, 'test_kol', $2, 'test-ciphertext', $3, $4, 'test-model')`,
      [reportId, 'a'.repeat(64), 'b'.repeat(64), buyerWallet],
    )
    fixtureInserted = true
  }, 60_000)

  afterAll(async () => {
    try {
      if (pool) {
        if (fixtureInserted) await pool.query('DELETE FROM dr_reports WHERE id = $1', [reportId])
        await pool.end()
      }
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalDatabaseUrl
    }
  }, 30_000)

  it('requires settled buyer payment and derives one vote weight and proof from that purchase', async () => {
    await expect(db.recordPurchaseVote(reportId, buyerWallet, 1)).resolves.toBeNull()

    const payment: PaymentVerification = {
      protocol: 'mpp-session',
      paymentRef,
      amountBaseUnits: 450_000n,
      payer: buyerWallet,
      settled: true,
      channel: {
        id: channelId,
        capBaseUnits: 1_000_000n,
        spentBaseUnits: 450_000n,
        claimedCumulativeBaseUnits: 450_000n,
        remainingBaseUnits: 550_000n,
        status: 'open',
      },
    }
    await expect(db.recordReportPayment(reportId, buyerWallet, { ...payment, payer: otherWallet }))
      .rejects.toThrow('Payment is not settled for the report owner')
    await expect(db.recordReportPayment(reportId, buyerWallet, { ...payment, settled: false }))
      .rejects.toThrow('Payment is not settled for the report owner')

    const paid = await db.recordReportPayment(reportId, buyerWallet, payment)
    expect(paid.payment_ref).toBe(paymentRef)
    expect(Number(paid.price_charged)).toBe(0.45)
    await expect(db.recordPurchaseVote(reportId, otherWallet, 1)).resolves.toBeNull()

    const vote = await db.recordPurchaseVote(reportId, buyerWallet, 1)
    expect(vote).toEqual({ value: 1, weightUsdc: '0.450000', proofRef: paymentRef })
    expect(await db.getVoteSummary(reportId)).toMatchObject({ up: 1, down: 0 })

    const changedVote = await db.recordPurchaseVote(reportId, buyerWallet, -1)
    expect(changedVote).toEqual({ value: -1, weightUsdc: '0.450000', proofRef: paymentRef })
    const summary = await db.getVoteSummary(reportId)
    expect(summary.up).toBe(0)
    expect(summary.down).toBe(1)
    expect(Number(summary.challengeUsdc)).toBe(0.45)
    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM dr_votes WHERE report_id = $1',
      [reportId],
    )
    expect(Number(count.rows[0].count)).toBe(1)
  }, 30_000)
})
