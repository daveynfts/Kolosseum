import { randomUUID } from 'node:crypto'
import bs58 from 'bs58'
import { getPool } from './db'
import { loadKolContext } from './kolContext'
import { decryptReport, encryptReport, sha256 } from '../evidence/reportCrypto'
import { assertSignedQuote, devnet } from '../payments/reportNft'
import { CREDIT_USD_MICROS, fetchSolRate, priceInLamports } from '../payments/solPricing'
import { parseBuyerWallet } from '../payments/walletAccess'
import { assetState, liveAssetTransaction, liveBase, liveOperator, paymentTransaction } from './liveChain'
import { canReadLive, liveEffort, livePolicy } from './livePolicy'
import { LIVE_TIERS, type LiveEffort, type LiveJobView, type LivePolicy, type LiveQuote } from './liveTypes'

export type LiveRow = { id: string; author_wallet: string; kol_handle: string; effort: LiveEffort; credits: number; status: string; policy: LivePolicy; quote: LiveQuote; context_encrypted: string; snapshot_at: string; sampled_posts: number; payment_transaction: string; signed_payment: string | null; payment_signature: string | null; result_encrypted: string | null; content_hash: string | null; asset: string | null; metadata_uri: string | null; event_count: number; generated_characters: number; error_code: string | null; created_at: Date }
type Operation = { id: string; job_id: string; wallet: string; kind: 'mint' | 'transfer_policy' | 'transfer' | 'refund'; payload: { asset?: string; uri?: string; allowTransfers?: boolean }; transaction: string; signed_transaction: string | null; signature: string | null; status: string; last_valid_block_height: string; expires_at: Date }
export function liveEncryptionKey() {
  const key = process.env.REPORT_ENC_KEY
  if (!key) throw new Error('Live report encryption is not configured')
  return key
}
export async function liveRow(id: string) {
  const row = (await getPool().query<LiveRow>('SELECT * FROM dr_live_jobs WHERE id=$1', [id])).rows[0]
  if (!row) throw new Error('Report not found')
  return row
}
function authorOnly(row: LiveRow, wallet: string) { if (row.author_wallet !== wallet) throw new Error('Only the report author can perform this action') }
export async function liveView(id: string, wallet: string | null): Promise<LiveJobView> {
  const row = await liveRow(id)
  const author = row.author_wallet === wallet
  // Private job existence and payment details are not exposed to unrelated wallets.
  let chain: Awaited<ReturnType<typeof assetState>> | undefined
  if (row.asset && row.content_hash && (wallet || row.policy.view === 'public')) chain = await assetState(row.asset, row.content_hash)
  const allowed = canReadLive(row.author_wallet, wallet, row.policy, chain?.owner || null)
  if (!author && !allowed && chain?.owner !== wallet) throw new Error('Report access denied')
  const content = allowed && row.status === 'ready' && row.result_encrypted ? JSON.parse(decryptReport(row.result_encrypted, liveEncryptionKey())).content as string : undefined
  if (content && sha256(content) !== row.content_hash) throw new Error('Report integrity check failed')
  return { paymentKind: (row as LiveRow & {payment_kind?: "sol-devnet" | "x402-sandbox"}).payment_kind || "sol-devnet", id: row.id, handle: row.kol_handle, author: row.author_wallet, effort: row.effort, credits: row.credits, status: row.status, policy: { ...row.policy, viewers: author ? row.policy.viewers : [] }, quote: row.quote, signature: row.payment_signature, transaction: author && row.status === 'quoted' ? row.payment_transaction : undefined, content, contentHash: row.content_hash, snapshotAt: row.snapshot_at, sampledPosts: row.sampled_posts, asset: row.asset, owner: chain?.owner, transfersAllowed: chain?.transfersAllowed, canManage: author, eventCount: row.event_count, generatedCharacters: row.generated_characters, error: (row as LiveRow & {payment_kind?:string}).payment_kind === 'x402-sandbox' ? row.error_code?.replace(/request a SOL refund/g, 'contact support with this sandbox order ID') || null : row.error_code, createdAt: new Date(row.created_at).toISOString() }
}
export async function liveCatalog(handle: string) {
  const context = await loadKolContext(handle, { postLimit: 50, includeTrackedAccounts: true })
  return { handle: context.actor.handle, displayName: context.actor.displayName, snapshotAt: context.source.scexAsOf, sampledPosts: context.posts.length, tiers: LIVE_TIERS, creditUsdMicros: CREDIT_USD_MICROS, network: 'devnet', maxWaitMinutes: 30 }
}
export async function quoteLive(wallet: string, input: Record<string, unknown>) {
  const effort = liveEffort(input.effort), policy = livePolicy(input.policy)
  const handle = String(input.handle || '').replace(/^@/, '').toLowerCase()
  const context = await loadKolContext(handle, { postLimit: 50, includeTrackedAccounts: true })
  if (context.posts.length < 1) throw new Error('No source posts available for this KOL')
  if (!process.env.SURF_API_KEY) throw new Error('Live research is not configured')
  const key = liveEncryptionKey(), operator = await liveOperator(), connection = await devnet()
  if (operator.publicKey.toBase58() === wallet) throw new Error('Use a buyer wallet different from the treasury')
  const db = await getPool().connect()
  try {
    await db.query('BEGIN')
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [wallet + ':live:' + handle])
    const existing = (await db.query<LiveRow>(`SELECT * FROM dr_live_jobs WHERE author_wallet=$1 AND kol_handle=$2 AND (status IN ('payment_pending','queued','running') OR (status='quoted' AND (quote->>'expiresAt')::timestamptz>now())) ORDER BY created_at DESC LIMIT 1`, [wallet, handle])).rows[0]
    if (existing) { await db.query('COMMIT'); return liveView(existing.id, wallet) }
    const id = randomUUID(), credits = LIVE_TIERS[effort], rate = await fetchSolRate(), latest = await connection.getLatestBlockhash('finalized')
    const lamports = priceInLamports(credits, rate.usdMicros)
    const tx = paymentTransaction(wallet, operator.publicKey.toBase58(), lamports, latest.blockhash, id)
    const fee = (await connection.getFeeForMessage(tx.compileMessage())).value
    if (fee === null) throw new Error('Unable to estimate payment fee')
    const quote: LiveQuote = { lamports, usdMicros: credits * CREDIT_USD_MICROS, solUsdMicros: rate.usdMicros, rateAsOf: rate.asOf, recipient: operator.publicKey.toBase58(), expiresAt: new Date(Date.now() + 60_000).toISOString(), ...latest, networkFeeLamports: fee }
    await db.query(`INSERT INTO dr_live_jobs (id,author_wallet,kol_handle,effort,credits,policy,quote,context_encrypted,snapshot_at,sampled_posts,payment_transaction) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, wallet, handle, effort, credits, policy, quote, encryptReport(JSON.stringify(context), key), context.source.scexAsOf, context.posts.length, tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')])
    await db.query('COMMIT')
    return liveView(id, wallet)
  } catch (e) { await db.query('ROLLBACK'); throw e } finally { db.release() }
}
export async function submitLivePayment(id: string, wallet: string, signed: string) {
  const row = await liveRow(id); authorOnly(row, wallet)
  if (!row.payment_signature) {
    if (row.status !== 'quoted' || Date.parse(row.quote.expiresAt) <= Date.now()) throw new Error('Quote expired. Request a fresh quote')
    const tx = assertSignedQuote(signed, row.payment_transaction, wallet)
    const saved = await getPool().query(`UPDATE dr_live_jobs SET signed_payment=$2,payment_signature=$3,status='payment_pending',updated_at=now() WHERE id=$1 AND status='quoted' AND payment_signature IS NULL`, [id, signed, bs58.encode(tx.signature!)])
    if (!saved.rowCount) throw new Error('Payment changed. Recover this report before paying again')
  }
  await reconcileLivePayment(id)
  return liveView(id, wallet)
}
export async function reconcileLivePayment(id: string) {
  const row = await liveRow(id)
  if (row.status !== 'payment_pending' || !row.payment_signature) return
  const connection = await devnet()
  const status = (await connection.getSignatureStatuses([row.payment_signature], { searchTransactionHistory: true })).value[0]
  if (status?.err) await getPool().query(`UPDATE dr_live_jobs SET status='failed',error_code='Payment failed on-chain; no research fee collected',updated_at=now() WHERE id=$1 AND status='payment_pending'`, [id])
  else if (status?.confirmationStatus === 'finalized') await getPool().query(`UPDATE dr_live_jobs SET status='queued',updated_at=now() WHERE id=$1 AND status='payment_pending'`, [id])
  else if (await connection.getBlockHeight('finalized') <= row.quote.lastValidBlockHeight) {
    try { await connection.sendRawTransaction(Buffer.from(row.signed_payment!, 'base64'), { maxRetries: 0, skipPreflight: false }) } catch { /* Reconcile the original signature, never charge again. */ }
  }
}
export async function updateLiveViewing(id: string, wallet: string, raw: unknown) {
  const row = await liveRow(id); authorOnly(row, wallet)
  const policy = livePolicy(raw)
  // Transfer settings change only after an author-signed on-chain operation.
  policy.allowTransfers = row.policy.allowTransfers
  await getPool().query(`UPDATE dr_live_jobs SET policy=jsonb_set(jsonb_set(policy,'{view}',$2::jsonb),'{viewers}',$3::jsonb),updated_at=now() WHERE id=$1`, [id, JSON.stringify(policy.view), JSON.stringify(policy.viewers)])
  return liveView(id, wallet)
}
export async function liveLibrary(wallet: string) {
  const rows = (await getPool().query<Pick<LiveRow, 'id' | 'kol_handle' | 'status' | 'asset' | 'created_at'>>(`SELECT id,kol_handle,status,asset,created_at FROM dr_live_jobs WHERE author_wallet=$1 OR (policy->>'view'='allowlist' AND policy->'viewers' ? $1) ORDER BY created_at DESC LIMIT 100`, [wallet])).rows
  return rows
}
export async function liveMetadata(id: string) {
  const row = await liveRow(id)
  if (row.status !== 'ready' || !row.content_hash) throw new Error('Report is not ready')
  return { name: `SurfAI · ${row.kol_handle}`, symbol: 'SURFAI', description: 'A report access NFT. The original author can change viewing permissions and freeze transfers even after resale. NFT ownership is not exclusive copyright. Report text is encrypted off-chain.', external_url: `${process.env.REPORT_APP_PUBLIC_URL || 'https://radar.daveynfts.com'}/me?report=${id}`, attributes: [{ trait_type: 'Author', value: row.author_wallet }, { trait_type: 'Report SHA-256', value: row.content_hash }, { trait_type: 'Snapshot', value: row.snapshot_at }], properties: { report_id: id, report_hash: row.content_hash, access: 'Authenticate through the application. This metadata does not contain report text.' } }
}
export async function prepareLiveOperation(id: string, wallet: string, kind: Operation['kind'], input: Record<string, unknown> = {}) {
  const row = await liveRow(id)
  if (kind === 'refund' && (row as LiveRow & {payment_kind?:string}).payment_kind === 'x402-sandbox') throw new Error('Invalid refund network: sandbox USDC cannot be refunded as Devnet SOL')
  if (kind !== 'transfer') authorOnly(row, wallet)
  if (kind === 'refund' ? row.status !== 'failed' : row.status !== 'ready') throw new Error('Report is not ready for this action')
  const db = await getPool().connect()
  try {
    await db.query('BEGIN'); await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['live-op:' + id])
    const connection = await devnet()
    const finalizedHeight = await connection.getBlockHeight('finalized')
    // Do not replace an unsigned operation while its blockhash can still land.
    await db.query(`UPDATE dr_live_operations SET status='failed' WHERE job_id=$1 AND status='quoted' AND expires_at<now() AND last_valid_block_height<$2`, [id, finalizedHeight])
    const prior = (await db.query<Operation>(`SELECT * FROM dr_live_operations WHERE job_id=$1 AND status IN ('quoted','submitted')`, [id])).rows[0]
    if (prior) { if (prior.wallet !== wallet) throw new Error('Another NFT operation is pending'); await db.query('COMMIT'); return operationView(prior) }
    const latest = await connection.getLatestBlockhash('finalized'), opId = randomUUID()
    let tx, payload: Operation['payload'] = {}
    if (kind === 'refund') {
      if (!row.payment_signature) throw new Error('No confirmed payment to refund')
      const payment = (await connection.getSignatureStatuses([row.payment_signature], { searchTransactionHistory: true })).value[0]
      if (payment?.err || payment?.confirmationStatus !== 'finalized') throw new Error('Payment is not finalized; refund unavailable')
      if ((await db.query(`SELECT id FROM dr_live_operations WHERE job_id=$1 AND kind='refund' AND status='confirmed'`, [id])).rowCount) throw new Error('Already refunded')
      const operator = await liveOperator()
      if (operator.publicKey.toBase58() !== row.quote.recipient) throw new Error('Refund treasury mismatch')
      tx = paymentTransaction(operator.publicKey.toBase58(), wallet, row.quote.lamports, latest.blockhash, opId)
      tx.sign(operator)
    } else {
      if (kind === 'mint' && row.asset) throw new Error('Report NFT already minted')
      if (kind !== 'mint') {
        if (!row.asset) throw new Error('Mint the report NFT first')
        const chain = await assetState(row.asset, row.content_hash!)
        if (kind === 'transfer' && (chain.owner !== wallet || !chain.transfersAllowed)) throw new Error('NFT transfer is not permitted for this wallet')
      }
      if (kind === 'transfer_policy' && typeof input.allowTransfers !== 'boolean') throw new Error('Invalid transfer permission')
      const allowTransfers = kind === 'transfer_policy' ? input.allowTransfers as boolean : row.policy.allowTransfers
      let uri = row.metadata_uri || undefined
      if (kind === 'mint') {
        uri = `${liveBase()}/live/reports/${id}/metadata`
        const hosted = await fetch(uri, { signal: AbortSignal.timeout(12_000) })
        if (!hosted.ok || JSON.stringify(await hosted.json()) !== JSON.stringify(await liveMetadata(id))) throw new Error('Publish the backend metadata endpoint before minting')
      }
      const built = liveAssetTransaction({ rpc: connection.rpcEndpoint, wallet, blockhash: latest.blockhash, id, kind, asset: row.asset || undefined, uri, hash: row.content_hash!, author: row.author_wallet, handle: row.kol_handle, allowTransfers, recipient: kind === 'transfer' ? parseBuyerWallet(input.recipient) : undefined })
      tx = built.tx; payload = { asset: built.asset, uri, allowTransfers }
    }
    const serialized = tx.serialize({ requireAllSignatures: kind === 'refund', verifySignatures: kind === 'refund' }).toString('base64')
    const op = (await db.query<Operation>(`INSERT INTO dr_live_operations (id,job_id,wallet,kind,payload,transaction,last_valid_block_height,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '60 seconds') RETURNING *`, [opId, id, wallet, kind, payload, serialized, latest.lastValidBlockHeight])).rows[0]
    await db.query('COMMIT')
    if (kind === 'refund') return submitLiveOperation(op.id, wallet, serialized)
    return operationView(op)
  } catch (e) { await db.query('ROLLBACK'); throw e } finally { db.release() }
}
function operationView(op: Operation) { return { id: op.id, jobId: op.job_id, kind: op.kind, status: op.status, transaction: op.status === 'quoted' && op.kind !== 'refund' ? op.transaction : undefined, signature: op.signature, expiresAt: op.expires_at } }
export async function submitLiveOperation(id: string, wallet: string, signed: string) {
  const op = (await getPool().query<Operation>('SELECT * FROM dr_live_operations WHERE id=$1 AND wallet=$2', [id, wallet])).rows[0]
  if (!op) throw new Error('Operation not found')
  if (!op.signature) {
    if (op.status !== 'quoted' || new Date(op.expires_at).getTime() < Date.now()) throw new Error('Operation quote expired')
    const row = await liveRow(op.job_id)
    const signer = op.kind === 'refund' ? row.quote.recipient : wallet
    const tx = assertSignedQuote(signed, op.transaction, signer)
    const saved = await getPool().query(`UPDATE dr_live_operations SET signed_transaction=$2,signature=$3,status='submitted' WHERE id=$1 AND signature IS NULL AND status='quoted'`, [id, signed, bs58.encode(tx.signature!)])
    if (!saved.rowCount) throw new Error('Operation changed; recover its status')
  }
  return reconcileLiveOperation(id, wallet)
}
export async function reconcileLiveOperation(id: string, wallet?: string) {
  const op = (await getPool().query<Operation>('SELECT * FROM dr_live_operations WHERE id=$1', [id])).rows[0]
  if (!op || (wallet && op.wallet !== wallet)) throw new Error('Operation not found')
  if (op.status !== 'submitted' || !op.signature) return operationView(op)
  const connection = await devnet()
  const status = (await connection.getSignatureStatuses([op.signature], { searchTransactionHistory: true })).value[0]
  if (status?.err) { await getPool().query(`UPDATE dr_live_operations SET status='failed' WHERE id=$1`, [id]); op.status = 'failed' }
  else if (status?.confirmationStatus === 'finalized') {
    const db = await getPool().connect()
    try {
      await db.query('BEGIN')
      const changed = await db.query(`UPDATE dr_live_operations SET status='confirmed' WHERE id=$1 AND status='submitted'`, [id])
      if (changed.rowCount) {
        if (op.kind === 'mint') await db.query(`UPDATE dr_live_jobs SET asset=$2,metadata_uri=$3,updated_at=now() WHERE id=$1`, [op.job_id, op.payload.asset, op.payload.uri])
        if (op.kind === 'transfer_policy') await db.query(`UPDATE dr_live_jobs SET policy=jsonb_set(policy,'{allowTransfers}',$2::jsonb),updated_at=now() WHERE id=$1`, [op.job_id, JSON.stringify(op.payload.allowTransfers)])
        if (op.kind === 'refund') await db.query(`UPDATE dr_live_jobs SET status='refunded',updated_at=now() WHERE id=$1 AND status='failed'`, [op.job_id])
      }
      await db.query('COMMIT'); op.status = 'confirmed'
    } catch (e) { await db.query('ROLLBACK'); throw e } finally { db.release() }
  } else if (await connection.getBlockHeight('finalized') <= Number(op.last_valid_block_height)) {
    try { await connection.sendRawTransaction(Buffer.from(op.signed_transaction!, 'base64'), { skipPreflight: false, maxRetries: 0 }) } catch { /* Keep the original signature until resolved. */ }
  }
  return operationView(op)
}
