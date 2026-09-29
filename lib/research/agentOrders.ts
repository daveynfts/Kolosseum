import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPool } from './db'
import { loadKolContext, type KolContext } from './kolContext'
import { decryptReport, encryptReport, sha256 } from '../evidence/reportCrypto'
import { inspectX402Receipt, parseX402Receipt } from '../payments/receipt'
import { liveEncryptionKey, liveView } from './liveService'

type Order = { id: string; requester: string; secret_hash: string; handle: string; context_encrypted: string; status: string; payer: string | null; payment_ref: string | null; created_at: Date; expires_at: Date }
export const AGENT_PRICE = 720000n
function gatewayBase() {
  const value = process.env.AGENT_GATEWAY_URL || ''
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(value)) throw new Error('Agent gateway is not configured')
  return value
}
export function agentGatewayAuthorized(value: unknown) {
  const expected = process.env.AGENT_ORIGIN_TOKEN
  return typeof value === 'string' && !!expected && expected.length >= 32 && timingSafeEqual(Buffer.from(sha256(value)), Buffer.from(sha256(expected)))
}
async function order(id: string) {
  const row = (await getPool().query<Order>('SELECT * FROM dr_agent_orders WHERE id=$1', [id])).rows[0]
  if (!row) throw new Error('Agent order not found')
  return row
}
function authorize(row: Order, token: unknown) {
  if (typeof token !== 'string' || token.length > 256 || !timingSafeEqual(Buffer.from(sha256(token)), Buffer.from(row.secret_hash))) throw new Error('Agent access denied')
}
export async function createAgentOrder(requester: string, handle: string) {
  const gateway = gatewayBase()
  if (!process.env.SURF_API_KEY || !process.env.AGENT_PAYEE || !process.env.AGENT_CHANNEL_PAYEE) throw new Error('Agent service is not configured')
  const context = await loadKolContext(handle, { postLimit: 50, includeTrackedAccounts: true })
  if (!context.posts.length) throw new Error('No source posts for this account')
  const db = await getPool().connect()
  try {
    await db.query('BEGIN'); await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['agent-order:' + requester])
    const count = Number((await db.query("SELECT count(*) AS n FROM dr_agent_orders WHERE requester=$1 AND created_at>now()-interval '24 hours'", [requester])).rows[0].n)
    if (count >= 20) throw new Error('Agent order limit reached; reuse an existing order')
    const id = randomUUID(), token = randomBytes(32).toString('base64url')
    await db.query('INSERT INTO dr_agent_orders(id,requester,secret_hash,handle,context_encrypted) VALUES($1,$2,$3,$4,$5)', [id,requester,sha256(token),context.actor.handle,encryptReport(JSON.stringify(context),liveEncryptionKey())])
    await db.query('COMMIT')
    return { id, token, handle: context.actor.handle, gateway, apiBase: (process.env.REPORT_NFT_PUBLIC_BASE_URL || 'https://surfai-api-production.up.railway.app') + '/live/agent', priceUsdc: '0.72', credits: 120, network: 'pay.sh sandbox (Surfpool/localnet)', sampledPosts: context.posts.length }
  } catch(e) { await db.query('ROLLBACK'); throw e } finally { db.release() }
}
export async function acceptAgentPurchase(id: string, token: unknown) {
  const row = await order(id); authorize(row, token)
  if (row.status === 'settled') throw new Error('Agent order already paid; read its status instead')
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new Error('Agent order expired')
  await getPool().query("UPDATE dr_agent_orders SET status='accepted',accepted_at=COALESCE(accepted_at,now()) WHERE id=$1 AND status='prepared'", [id])
  // x402-upto settles after the origin responds. Do not start Surf here.
  return { orderId: id, status: 'awaiting_receipt', surfUsage: { creditsUsed: 120, creditsSource: 'published-rate' }, next: 'Submit the PAYMENT-RESPONSE header to the receipt endpoint. Do not pay again.' }
}
export async function settleAgentOrder(id: string, token: unknown, receipt: string) {
  const row = await order(id); authorize(row, token)
  if (row.status === 'settled') return agentOrderStatus(id, token)
  if (row.status !== 'accepted') throw new Error('Agent order has not passed the payment gateway')
  const parsed = parseX402Receipt(receipt)
  if (parsed.amount !== AGENT_PRICE) throw new Error('Agent receipt price mismatch')
  const verified = await inspectX402Receipt({ receipt, rpcUrl: process.env.AGENT_SANDBOX_RPC_URL || 'https://402.surfnet.dev:8899', expectedPayer: parsed.payer, expectedPayee: process.env.AGENT_PAYEE!, expectedChannelPayee: process.env.AGENT_CHANNEL_PAYEE! })
  const db = await getPool().connect(), paymentRef = 'x402:' + verified.transaction
  try {
    await db.query('BEGIN')
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [paymentRef])
    const locked = (await db.query<Order>('SELECT * FROM dr_agent_orders WHERE id=$1 FOR UPDATE', [id])).rows[0]
    if (locked.status === 'settled') { await db.query('COMMIT'); return agentOrderStatus(id, token) }
    const used = await db.query('SELECT id FROM dr_agent_orders WHERE payment_ref=$1 UNION ALL SELECT id FROM dr_reports WHERE payment_ref=$1', [paymentRef])
    if (used.rowCount) throw new Error('Agent receipt already used')
    const context = JSON.parse(decryptReport(row.context_encrypted, liveEncryptionKey())) as KolContext
    const quote = { lamports: '0', usdMicros: Number(AGENT_PRICE), solUsdMicros: 0, recipient: process.env.AGENT_PAYEE, expiresAt: new Date(row.expires_at).toISOString(), blockhash: '', lastValidBlockHeight: 0, networkFeeLamports: 0, rateAsOf: new Date().toISOString() }
    await db.query(`INSERT INTO dr_live_jobs(id,author_wallet,kol_handle,effort,credits,status,policy,quote,context_encrypted,snapshot_at,sampled_posts,payment_transaction,payment_kind) VALUES($1,$2,$3,'medium',120,'queued',$4,$5,$6,$7,$8,'','x402-sandbox')`, [id,verified.payer,row.handle,{view:'allowlist',viewers:[row.requester],allowTransfers:false},quote,row.context_encrypted,context.source.scexAsOf,context.posts.length])
    await db.query("UPDATE dr_agent_orders SET status='settled',payer=$2,payment_ref=$3,receipt_encrypted=$4 WHERE id=$1", [id,verified.payer,paymentRef,encryptReport(receipt,liveEncryptionKey())])
    await db.query('COMMIT')
  } catch(e) { await db.query('ROLLBACK'); throw e } finally { db.release() }
  return agentOrderStatus(id, token)
}
export async function agentOrderStatus(id: string, token: unknown, requester?: string) {
  const row = await order(id)
  if (requester !== row.requester) authorize(row, token)
  const report = row.status === 'settled' ? await liveView(id, row.requester) : null
  return { id, handle: row.handle, status: report?.status || row.status, payment: { protocol:'x402-upto', network:'Surfpool/localnet', amountUsdc:'0.72', verified:row.status==='settled', payer:row.payer, transaction:row.payment_ref?.replace(/^x402:/,'') || null }, report, reportUrl: `${process.env.REPORT_APP_PUBLIC_URL || 'https://radar.daveynfts.com'}/me?report=${id}`, expiresAt: row.expires_at }
}
