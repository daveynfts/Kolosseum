import pg from 'pg'
import type { SurfUsage } from './surfClient'
import type { PaymentVerification } from '../payments/reconcile'
import { formatUsdc, isNextVoucher, parseUsdc } from '../payments/reconcile'

const { Pool } = pg
let pool: pg.Pool | undefined

export type ResearchTemplate = {
  slug: string
  title: string
  description: string
  prompt_system: string
  prompt_user: string
  price_usdc: string
  price_usdc_cached: string
  enabled: boolean
}

export type StoredReport = {
  id: string
  kol_ref: string
  template_slug: string | null
  prompt_hash: string
  content_encrypted: string
  content_hash: string
  buyer_wallet: string | null
  payment_ref: string | null
  evidence_tx: string | null
  price_charged: string
  surf_model: string
  surf_usage: SurfUsage
  context_as_of: Date | null
  created_at: Date
}

export function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured')
  if (!pool) pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 8_000 })
  return pool
}

export async function listTemplates(): Promise<ResearchTemplate[]> {
  const result = await getPool().query<ResearchTemplate>(
    'SELECT slug, title, description, prompt_system, prompt_user, price_usdc, price_usdc_cached, enabled FROM dr_templates WHERE enabled = true ORDER BY slug',
  )
  return result.rows
}

export async function getTemplate(slug: string): Promise<ResearchTemplate | null> {
  const result = await getPool().query<ResearchTemplate>(
    'SELECT slug, title, description, prompt_system, prompt_user, price_usdc, price_usdc_cached, enabled FROM dr_templates WHERE slug = $1 AND enabled = true',
    [slug],
  )
  return result.rows[0] || null
}

export async function insertReport(data: {
  kolRef: string
  buyerWallet: string | null
  templateSlug: string | null
  promptHash: string
  contentEncrypted: string
  contentHash: string
  surfModel: string
  surfUsage: SurfUsage
  contextAsOf: string | null
}): Promise<StoredReport> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<StoredReport>(
      `INSERT INTO dr_reports
       (kol_ref, template_slug, prompt_hash, content_encrypted, content_hash, surf_model, surf_usage, context_as_of, buyer_wallet)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, $9)
       RETURNING *`,
      [data.kolRef, data.templateSlug, data.promptHash, data.contentEncrypted, data.contentHash,
        data.surfModel, JSON.stringify(data.surfUsage), data.contextAsOf, data.buyerWallet],
    )
    await client.query('INSERT INTO dr_evidence_jobs (report_id) VALUES ($1)', [result.rows[0].id])
    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getReport(id: string): Promise<StoredReport | null> {
  const result = await getPool().query<StoredReport>('SELECT * FROM dr_reports WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function getResearchStats(): Promise<{ reports: number; surfCredits: number | null; cacheHits: number }> {
  const result = await getPool().query<{
    reports: string
    surf_credits: string | null
    cache_hits: string
  }>(`SELECT count(*) AS reports,
      sum((surf_usage->>'creditsUsed')::numeric) AS surf_credits,
      count(*) FILTER (WHERE surf_usage->>'cacheHit' = 'true') AS cache_hits
      FROM dr_reports`)
  return {
    reports: Number(result.rows[0].reports),
    surfCredits: result.rows[0].surf_credits == null ? null : Number(result.rows[0].surf_credits),
    cacheHits: Number(result.rows[0].cache_hits),
  }
}

export async function recordReportPayment(
  reportId: string,
  buyerWallet: string,
  payment: PaymentVerification,
): Promise<StoredReport> {
  if (!payment.settled || payment.payer !== buyerWallet) throw new Error('Payment is not settled for the report owner')
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const locked = await client.query<StoredReport>(
      'SELECT * FROM dr_reports WHERE id = $1 AND buyer_wallet = $2 FOR UPDATE',
      [reportId, buyerWallet],
    )
    const report = locked.rows[0]
    if (!report) throw new Error('Report buyer does not match payment payer')
    if (report.payment_ref) {
      if (report.payment_ref !== payment.paymentRef) throw new Error('Report already has a different payment')
      await client.query('COMMIT')
      return report
    }
    if (payment.channel) {
      const cumulative = payment.channel.claimedCumulativeBaseUnits
      const amount = payment.amountBaseUnits
      const existing = await client.query<{ wallet: string; claimed_usdc: string }>(
        'SELECT wallet, claimed_usdc FROM dr_channels WHERE channel_id = $1 FOR UPDATE',
        [payment.channel.id],
      )
      const prior = existing.rows[0]
        ? parseUsdc(existing.rows[0].claimed_usdc) : 0n
      if ((existing.rows[0] && existing.rows[0].wallet !== buyerWallet) || !isNextVoucher(prior, cumulative, amount)) {
        throw new Error('Channel voucher sequence mismatch')
      }
      if (existing.rows[0]) {
        await client.query(
          `UPDATE dr_channels SET spent_usdc = GREATEST(spent_usdc, $2::numeric),
             claimed_usdc = $3, status = CASE WHEN $4 = 'closed' THEN 'closed'
               WHEN status = 'closed' THEN 'closed' ELSE $4 END
           WHERE channel_id = $1`,
          [payment.channel.id, formatUsdc(payment.channel.spentBaseUnits),
            formatUsdc(cumulative), payment.channel.status],
        )
      } else {
        await client.query(
          `INSERT INTO dr_channels (wallet, channel_id, cap_usdc, spent_usdc, claimed_usdc, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [buyerWallet, payment.channel.id, formatUsdc(payment.channel.capBaseUnits),
            formatUsdc(payment.channel.spentBaseUnits), formatUsdc(cumulative), payment.channel.status],
        )
      }
    }
    const updated = await client.query<StoredReport>(
      `UPDATE dr_reports SET payment_ref = $2, price_charged = $3
       WHERE id = $1 RETURNING *`,
      [reportId, payment.paymentRef, formatUsdc(payment.amountBaseUnits)],
    )
    await client.query('COMMIT')
    return updated.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
