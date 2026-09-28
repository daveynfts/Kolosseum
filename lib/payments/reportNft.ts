import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createNoopSigner, generateSigner, publicKey, signerIdentity } from '@metaplex-foundation/umi'
import { create, mplCore } from '@metaplex-foundation/mpl-core'
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'
import bs58 from 'bs58'
import { getPool } from '../research/db'
import { sha256 } from '../evidence/reportCrypto'
import { CREDIT_USD_MICROS, fetchSolRate, priceInLamports } from './solPricing'

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
export type PremiumReport = { version: number; handle: string; displayName: string; model: string; effort: string; credits: number; creditsSource: string; creditUsdMicros: number; content: string; contentHash: string; createdAt: string; snapshotAt: string; sampledPosts: number; sources: Array<{ url: string; postedAt: string }>; editorialReview?: { reviewedAt: string; originalContentHash: string; method: string; changes: string[] } }
export type NftQuote = { id: string; buyer: string; recipient: string; asset: string; contentHash: string; credits: number; usdMicros: number; solUsdMicros: number; rateAsOf: string; rateSource: string; lamports: string; networkFeeLamports: number; mintCostEstimateLamports: number; blockhash: string; lastValidBlockHeight: number; expiresAt: string; metadataUri: string; network: 'devnet' }
type Row = { id: string; buyer_wallet: string; content_hash: string; report: PremiumReport; quote: NftQuote; transaction_base64: string; signed_transaction_base64: string | null; signature: string | null; status: 'quoted' | 'submitted' | 'confirmed' | 'failed' }
export async function premiumReport(): Promise<PremiumReport> {
  const report = JSON.parse(await readFile('public/demo/nbaluong-premium.json', 'utf8')) as PremiumReport
  if (report.handle !== 'luong4101992' || report.effort !== 'xhigh' || report.creditUsdMicros !== CREDIT_USD_MICROS || sha256(report.content) !== report.contentHash) throw new Error('Premium report integrity failed')
  priceInLamports(report.credits, 100_000_000)
  return report
}
export function publicBase() {
  const raw = process.env.REPORT_NFT_PUBLIC_BASE_URL
  if (!raw) throw new Error('Public NFT storage URL is not configured')
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || /localhost|127\.0\.0\.1/.test(url.hostname)) throw new Error('Public NFT storage requires HTTPS')
  return raw.replace(/\/$/, '')
}
export async function devnet() {
  const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
  if (new URL(endpoint).protocol !== 'https:') throw new Error('Devnet RPC requires HTTPS')
  const connection = new Connection(endpoint, 'confirmed')
  if (await connection.getGenesisHash() !== DEVNET_GENESIS) throw new Error('This checkout only supports Solana Devnet')
  return connection
}
async function treasury() {
  if (process.env.REPORT_SOL_TREASURY) return new PublicKey(process.env.REPORT_SOL_TREASURY)
  if (!process.env.OPERATOR_KEYPAIR_PATH) throw new Error('Devnet treasury is not configured')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(process.env.OPERATOR_KEYPAIR_PATH, 'utf8')))).publicKey
}
export function nftMetadata(report: PremiumReport, base: string) {
  return { name: `SurfAI · ${report.handle}`, symbol: 'SURFAI', description: 'A collectible edition of a prepared SurfAI research report. Devnet test NFT; not investment advice or exclusive copyright.', image: `${base}/arena/loading/01-rome-1920.webp`, external_url: `${base}/scex?kol=${report.handle}&tab=surfai`, attributes: [{ trait_type: 'KOL', value: report.handle }, { trait_type: 'Model', value: report.model }, { trait_type: 'Reasoning', value: report.effort }, { trait_type: 'Credits', value: report.credits }, { trait_type: 'SHA-256', value: report.contentHash }, { trait_type: 'Snapshot', value: report.snapshotAt }], properties: { category: 'document', report_hash: report.contentHash, report_uri: `${base}/demo/reports/${report.contentHash}.json`, files: [{ uri: `${base}/demo/reports/${report.contentHash}.json`, type: 'application/json' }] } }
}
async function verifyHostedReport(report: PremiumReport, base: string) {
  const uri = `${base}/demo/nft/${report.contentHash}.json`
  const [metadata, content] = await Promise.all([fetch(uri, { signal: AbortSignal.timeout(10_000) }), fetch(`${base}/demo/reports/${report.contentHash}.json`, { signal: AbortSignal.timeout(10_000) })])
  if (!metadata.ok || !content.ok) throw new Error('Publish the report and NFT metadata before accepting payment')
  const m = await metadata.json(), r = await content.json()
  if (JSON.stringify(m) !== JSON.stringify(nftMetadata(report, base)) || r.contentHash !== report.contentHash || typeof r.content !== 'string' || sha256(r.content) !== report.contentHash) throw new Error('Hosted NFT metadata or report hash mismatch')
  return uri
}
export async function nftStorageConfigured() {
  if (process.env.REPORT_NFT_PUBLIC_BASE_URL) return true
  try { await readFile('public/demo/nft-storage.json', 'utf8'); return true } catch { return false }
}
async function verifiedMetadataUri(report: PremiumReport) {
  let stored: string
  try { stored = await readFile('public/demo/nft-storage.json', 'utf8') } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    return verifyHostedReport(report, publicBase())
  }
  const storage = JSON.parse(stored) as { contentHash: string; metadataUri: string; reportUri: string; metadataHash: string }
  if (storage.contentHash !== report.contentHash || !/^https:\/\//.test(storage.metadataUri) || !/^https:\/\//.test(storage.reportUri)) throw new Error('Hosted NFT storage does not match the report')
  const [metadataResponse, reportResponse] = await Promise.all([fetch(storage.metadataUri, { signal: AbortSignal.timeout(15_000) }), fetch(storage.reportUri, { signal: AbortSignal.timeout(15_000) })])
  if (!metadataResponse.ok || !reportResponse.ok) throw new Error('Hosted NFT storage is not reachable')
  const metadata = await metadataResponse.json(), document = await reportResponse.json()
  if (sha256(JSON.stringify(metadata)) !== storage.metadataHash || metadata.properties?.report_hash !== report.contentHash || metadata.properties?.report_uri !== storage.reportUri || typeof document.content !== 'string' || sha256(document.content) !== report.contentHash) throw new Error('Hosted NFT content failed integrity verification')
  return storage.metadataUri
}
export function assertSignedQuote(encoded: string, expected: string, buyer: string) {
  if (encoded.length > 4000) throw new Error('Invalid signed transaction')
  const transaction = Transaction.from(Buffer.from(encoded, 'base64'))
  const original = Transaction.from(Buffer.from(expected, 'base64'))
  if (!transaction.serializeMessage().equals(original.serializeMessage()) || transaction.feePayer?.toBase58() !== buyer || !transaction.verifySignatures()) throw new Error('Signed transaction does not match the quoted purchase')
  return transaction
}
function publicPurchase(row: Row) {
  return { id: row.id, quote: row.quote, status: row.status, signature: row.signature, transaction: row.status === 'quoted' ? row.transaction_base64 : undefined, report: row.status === 'confirmed' ? row.report : undefined }
}
export function buildNftTransaction(input: { buyer: string; recipient: string; uri: string; id: string; contentHash: string; handle: string; lamports: string; blockhash: string; rpc: string }) {
  const umi = createUmi(input.rpc).use(mplCore()).use(signerIdentity(createNoopSigner(publicKey(input.buyer))))
  const asset = generateSigner(umi)
  const builder = create(umi, { asset, owner: publicKey(input.buyer), name: `SurfAI · ${input.handle}`, uri: input.uri, plugins: [{ type: 'ImmutableMetadata' }, { type: 'Attributes', attributeList: [{ key: 'report_sha256', value: input.contentHash }], authority: { type: 'None' } }] })
  const tx = new Transaction({ feePayer: new PublicKey(input.buyer), recentBlockhash: input.blockhash })
    .add(SystemProgram.transfer({ fromPubkey: new PublicKey(input.buyer), toPubkey: new PublicKey(input.recipient), lamports: BigInt(input.lamports) }))
    .add(...builder.getInstructions().map(toWeb3JsInstruction))
    .add(new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [], data: Buffer.from(`Kolosseum:${input.id}:${input.contentHash}`) }))
  tx.partialSign(Keypair.fromSecretKey(asset.secretKey))
  return { tx, asset: asset.publicKey }
}
export async function createNftQuote(buyer: string) {
  const report = await premiumReport()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [buyer + report.contentHash])
    const prior = (await client.query<Row>('SELECT * FROM dr_nft_purchases WHERE buyer_wallet=$1 AND content_hash=$2 FOR UPDATE', [buyer, report.contentHash])).rows[0]
    // Never quote a second payment after a submitted/confirmed transaction.
    if (prior && (prior.signature || Date.parse(prior.quote.expiresAt) > Date.now())) { await client.query('COMMIT'); return publicPurchase(prior) }
    const connection = await devnet(), recipient = await treasury()
    if (recipient.toBase58() === buyer) throw new Error('Use a buyer wallet different from the treasury')
    const uri = await verifiedMetadataUri(report), rate = await fetchSolRate()
    const id = prior?.id || randomUUID(), lamports = priceInLamports(report.credits, rate.usdMicros)
    const latest = await connection.getLatestBlockhash('confirmed')
    const { tx, asset } = buildNftTransaction({ buyer, recipient: recipient.toBase58(), uri, id, contentHash: report.contentHash, handle: report.handle, lamports, blockhash: latest.blockhash, rpc: connection.rpcEndpoint })
    const fee = (await connection.getFeeForMessage(tx.compileMessage())).value
    if (fee === null) throw new Error('Unable to estimate network fee')
    // Conservative mint/rent estimate; wallet simulation displays the actual total.
    const mintCostEstimateLamports = 10_000_000
    if (await connection.getBalance(new PublicKey(buyer)) < Number(lamports) + fee + mintCostEstimateLamports) throw new Error('Insufficient Devnet SOL. Fund your wallet for the report plus approximately 0.01 SOL mint/rent.')
    const quote: NftQuote = { id, buyer, recipient: recipient.toBase58(), asset, contentHash: report.contentHash, credits: report.credits, usdMicros: report.credits * CREDIT_USD_MICROS, solUsdMicros: rate.usdMicros, rateAsOf: rate.asOf, rateSource: rate.source, lamports, networkFeeLamports: fee, mintCostEstimateLamports, ...latest, expiresAt: new Date(Date.now() + 60_000).toISOString(), metadataUri: uri, network: 'devnet' }
    const transaction = tx.serialize({ requireAllSignatures: false }).toString('base64')
    const row = (await client.query<Row>(`INSERT INTO dr_nft_purchases (id,buyer_wallet,content_hash,report,quote,transaction_base64) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (buyer_wallet,content_hash) DO UPDATE SET quote=$5,transaction_base64=$6,updated_at=now() RETURNING *`, [id, buyer, report.contentHash, report, quote, transaction])).rows[0]
    await client.query('COMMIT')
    return publicPurchase(row)
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
}
async function getPurchase(id: string, buyer: string) {
  const row = (await getPool().query<Row>('SELECT * FROM dr_nft_purchases WHERE id=$1 AND buyer_wallet=$2', [id, buyer])).rows[0]
  if (!row) throw new Error('Purchase not found for this wallet')
  return row
}
export async function submitNftPurchase(id: string, buyer: string, signed: string) {
  const row = await getPurchase(id, buyer)
  if (row.signature) return refreshNftPurchase(id, buyer)
  if (Date.parse(row.quote.expiresAt) < Date.now()) throw new Error('Quote expired. Refresh the quote before signing again.')
  const tx = assertSignedQuote(signed, row.transaction_base64, buyer)
  const signature = bs58.encode(tx.signature!)
  // Persist before broadcasting. Recover with the same bytes/signature after an ambiguous timeout.
  const updated = await getPool().query("UPDATE dr_nft_purchases SET signature=$3,signed_transaction_base64=$4,status='submitted',updated_at=now() WHERE id=$1 AND buyer_wallet=$2 AND signature IS NULL AND transaction_base64=$5", [id, buyer, signature, signed, row.transaction_base64])
  if (!updated.rowCount) throw new Error('Quote changed. Check purchase status before continuing.')
  return refreshNftPurchase(id, buyer)
}
export async function refreshNftPurchase(id: string, buyer: string) {
  const row = await getPurchase(id, buyer)
  if (row.status === 'confirmed' || !row.signature || row.status === 'failed') return publicPurchase(row)
  const connection = await devnet()
  const status = (await connection.getSignatureStatuses([row.signature], { searchTransactionHistory: true })).value[0]
  if (status?.err) {
    await getPool().query("UPDATE dr_nft_purchases SET status='failed',updated_at=now() WHERE id=$1", [id]); row.status = 'failed'
  } else if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
    // The exact signed message was verified and persisted before broadcast; all mint + transfer instructions are atomic.
    await getPool().query("UPDATE dr_nft_purchases SET status='confirmed',updated_at=now() WHERE id=$1", [id]); row.status = 'confirmed'
  } else if (await connection.getBlockHeight() <= row.quote.lastValidBlockHeight) {
    try { await connection.sendRawTransaction(Buffer.from(row.signed_transaction_base64!, 'base64'), { skipPreflight: false, maxRetries: 0 }) } catch { /* retain original transaction for reconciliation; never prompt another payment */ }
  }
  return publicPurchase(row)
}
export async function listNftPurchases(buyer: string) {
  const rows = (await getPool().query<Row>('SELECT * FROM dr_nft_purchases WHERE buyer_wallet=$1 ORDER BY created_at DESC LIMIT 100', [buyer])).rows
  return rows.map(publicPurchase)
}
