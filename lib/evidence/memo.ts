import { readFile } from 'node:fs/promises'
import bs58 from 'bs58'
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
} from '@solana/web3.js'
import { getPool, getReport, type StoredReport } from '../research/db'

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

type EvidenceJob = {
  report_id: string
  status: 'pending' | 'signed' | 'confirmed' | 'needs_review'
  signature: string | null
  signed_tx_base64: string | null
  blockhash: string | null
  last_valid_block_height: string | null
}

export function memoPayload(report: StoredReport): string {
  return JSON.stringify({
    app: 'kolosseum', version: 1, reportId: report.id,
    hash: report.content_hash, timestamp: report.created_at.toISOString(),
    kol: report.kol_ref, template: report.template_slug,
  })
}

async function devnetConnection(): Promise<Connection> {
  const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
  if (new URL(endpoint).protocol !== 'https:') throw new Error('Solana RPC must use HTTPS')
  const connection = new Connection(endpoint, 'confirmed')
  if (await connection.getGenesisHash() !== DEVNET_GENESIS) {
    throw new Error('SOLANA_RPC_URL is not Solana devnet')
  }
  return connection
}

async function operatorKeypair(): Promise<Keypair> {
  const path = process.env.OPERATOR_KEYPAIR_PATH
  if (!path) throw new Error('OPERATOR_KEYPAIR_PATH is not configured')
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
  if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
    throw new Error('Invalid operator keypair file')
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed))
}

async function markConfirmed(reportId: string, signature: string): Promise<void> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const reportUpdate = await client.query('UPDATE dr_reports SET evidence_tx = $2 WHERE id = $1 AND (evidence_tx IS NULL OR evidence_tx = $2)', [reportId, signature])
    if (reportUpdate.rowCount !== 1) throw new Error('Evidence report signature conflict')
    const jobUpdate = await client.query("UPDATE dr_evidence_jobs SET status = 'confirmed', updated_at = now(), last_error = NULL WHERE report_id = $1 AND signature = $2", [reportId, signature])
    if (jobUpdate.rowCount !== 1) throw new Error('Evidence job signature conflict')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function processEvidence(reportId: string): Promise<{ status: EvidenceJob['status']; signature: string | null }> {
  const report = await getReport(reportId)
  if (!report) throw new Error('Report not found')
  const connection = await devnetConnection()
  const db = getPool()
  const loadJob = async () => {
    const result = await db.query<EvidenceJob>('SELECT * FROM dr_evidence_jobs WHERE report_id = $1', [reportId])
    if (!result.rows[0]) throw new Error('Evidence job not found')
    return result.rows[0]
  }
  let job = await loadJob()
  if (job.status === 'confirmed' || job.status === 'needs_review') {
    return { status: job.status, signature: job.signature }
  }
  if (!job.signature) {
    const keypair = await operatorKeypair()
    const latest = await connection.getLatestBlockhash('confirmed')
    const tx = new Transaction({ feePayer: keypair.publicKey, recentBlockhash: latest.blockhash })
      .add(new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM,
        data: Buffer.from(memoPayload(report), 'utf8'),
      }))
    tx.sign(keypair)
    if (!tx.signature) throw new Error('Memo signing failed')
    const signature = bs58.encode(tx.signature)
    await db.query(
      `UPDATE dr_evidence_jobs
       SET status = 'signed', signature = $2, signed_tx_base64 = $3,
           blockhash = $4, last_valid_block_height = $5, updated_at = now()
       WHERE report_id = $1 AND signature IS NULL`,
      [reportId, signature, tx.serialize().toString('base64'), latest.blockhash, latest.lastValidBlockHeight],
    )
    job = await loadJob()
  }
  if (!job.signature || !job.signed_tx_base64 || !job.blockhash || !job.last_valid_block_height) {
    throw new Error('Evidence job is missing its signed transaction')
  }
  const statuses = await connection.getSignatureStatuses([job.signature], { searchTransactionHistory: true })
  const prior = statuses.value[0]
  if (prior?.err) {
    await db.query("UPDATE dr_evidence_jobs SET status = 'needs_review', last_error = 'Transaction failed', updated_at = now() WHERE report_id = $1", [reportId])
    return { status: 'needs_review', signature: job.signature }
  }
  if (prior && ['confirmed', 'finalized'].includes(prior.confirmationStatus || '')) {
    await markConfirmed(reportId, job.signature)
    return { status: 'confirmed', signature: job.signature }
  }
  if (await connection.getBlockHeight('confirmed') > Number(job.last_valid_block_height)) {
    await db.query("UPDATE dr_evidence_jobs SET status = 'needs_review', last_error = 'Blockhash expired with uncertain landing', updated_at = now() WHERE report_id = $1", [reportId])
    return { status: 'needs_review', signature: job.signature }
  }
  try {
    const sentSignature = await connection.sendRawTransaction(Buffer.from(job.signed_tx_base64, 'base64'), { skipPreflight: false, maxRetries: 2 })
    if (sentSignature !== job.signature) throw new Error('Memo signature mismatch')
    const confirmation = await connection.confirmTransaction({ signature: job.signature, blockhash: job.blockhash, lastValidBlockHeight: Number(job.last_valid_block_height) }, 'confirmed')
    if (confirmation.value.err) throw new Error('Memo transaction failed')
    await markConfirmed(reportId, job.signature)
    return { status: 'confirmed', signature: job.signature }
  } catch {
    // Keep the same signed transaction for replay. Never sign a second Memo
    // after an ambiguous broadcast.
    await db.query("UPDATE dr_evidence_jobs SET attempts = attempts + 1, last_error = 'Broadcast or confirmation failed', updated_at = now() WHERE report_id = $1", [reportId])
    return { status: 'signed', signature: job.signature }
  }
}

export async function verifyEvidence(report: StoredReport): Promise<boolean | null> {
  if (!report.evidence_tx) return null
  const connection = await devnetConnection()
  const tx = await connection.getTransaction(report.evidence_tx, {
    commitment: 'confirmed', maxSupportedTransactionVersion: 0,
  })
  if (!tx || tx.meta?.err) return false
  const message = tx.transaction.message
  const keys = 'accountKeys' in message ? message.accountKeys : message.staticAccountKeys
  const operator = await operatorKeypair()
  if (!keys[0]?.equals(operator.publicKey)) return false
  const instructions = 'instructions' in message ? message.instructions : message.compiledInstructions
  return instructions.some((instruction) => {
    const key = keys[instruction.programIdIndex]
    const data = typeof instruction.data === 'string'
      ? Buffer.from(bs58.decode(instruction.data))
      : Buffer.from(instruction.data)
    return key?.equals(MEMO_PROGRAM) && data.toString('utf8') === memoPayload(report)
  })
}
