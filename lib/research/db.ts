import pg from 'pg'
import type { SurfUsage } from './surfClient'

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
