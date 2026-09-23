import { config as loadEnv } from 'dotenv'
import { getPool } from '../../lib/research/db'
import { processEvidence } from '../../lib/evidence/memo'

loadEnv({ path: '.env.local', quiet: true })
const db = getPool()
try {
  const jobs = await db.query<{ report_id: string }>(
    "SELECT report_id FROM dr_evidence_jobs WHERE status IN ('pending', 'signed') ORDER BY updated_at LIMIT 20",
  )
  for (const job of jobs.rows) {
    try {
      const result = await processEvidence(job.report_id)
      process.stdout.write(`${job.report_id}: ${result.status}\n`)
    } catch {
      process.stdout.write(`${job.report_id}: retry later\n`)
    }
  }
} finally {
  await db.end()
}
