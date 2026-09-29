import { readFile } from 'node:fs/promises'
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createNoopSigner, generateSigner, publicKey, signerIdentity } from '@metaplex-foundation/umi'
import { create, fetchAsset, mplCore, transfer, updatePlugin } from '@metaplex-foundation/mpl-core'
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'
import { devnet } from '../payments/reportNft'

export async function liveOperator() {
  const raw = process.env.LIVE_OPERATOR_SECRET_KEY || (process.env.OPERATOR_KEYPAIR_PATH ? await readFile(process.env.OPERATOR_KEYPAIR_PATH, 'utf8') : '')
  if (!raw) throw new Error('Live research treasury is not configured')
  const operator = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
  if (process.env.REPORT_SOL_TREASURY && process.env.REPORT_SOL_TREASURY !== operator.publicKey.toBase58()) throw new Error('Live research requires a refundable operator treasury')
  return operator
}
export function liveBase() {
  const base = (process.env.REPORT_NFT_PUBLIC_BASE_URL || '').replace(/\/$/, '')
  const url = new URL(base)
  if (url.protocol !== 'https:' || url.username || url.password || /localhost|127\.0\.0\.1/.test(url.hostname)) throw new Error('Live NFT metadata requires a public HTTPS backend URL')
  return base
}
export function memo(id: string) {
  return new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [], data: Buffer.from('Kolosseum live:' + id) })
}
export function paymentTransaction(wallet: string, recipient: string, lamports: string, blockhash: string, id: string) {
  return new Transaction({ feePayer: new PublicKey(wallet), recentBlockhash: blockhash }).add(SystemProgram.transfer({ fromPubkey: new PublicKey(wallet), toPubkey: new PublicKey(recipient), lamports: BigInt(lamports) }), memo(id))
}
export async function assetState(asset: string, expectedHash: string) {
  const rpc = await devnet()
  const value = await fetchAsset(createUmi(rpc.rpcEndpoint).use(mplCore()), publicKey(asset), { commitment: 'finalized' })
  if (value.attributes?.attributeList.find(a => a.key === 'report_sha256')?.value !== expectedHash) throw new Error('NFT report binding mismatch')
  return { owner: String(value.owner), transfersAllowed: value.permanentFreezeDelegate?.frozen === false }
}
export function liveAssetTransaction(input: { rpc: string; wallet: string; blockhash: string; id: string; kind: 'mint' | 'transfer_policy' | 'transfer'; asset?: string; uri?: string; hash: string; author: string; handle: string; allowTransfers: boolean; recipient?: string }) {
  const umi = createUmi(input.rpc).use(mplCore()).use(signerIdentity(createNoopSigner(publicKey(input.wallet))))
  const signer = input.kind === 'mint' ? generateSigner(umi) : undefined
  const builder = signer ? create(umi, { asset: signer, owner: publicKey(input.author), updateAuthority: publicKey(input.author), name: `SurfAI · ${input.handle}`, uri: input.uri!, plugins: [
    { type: 'ImmutableMetadata' },
    { type: 'Attributes', authority: { type: 'None' }, attributeList: [{ key: 'report_sha256', value: input.hash }, { key: 'report_id', value: input.id }, { key: 'author', value: input.author }] },
    { type: 'PermanentFreezeDelegate', frozen: !input.allowTransfers, authority: { type: 'Address', address: publicKey(input.author) } },
  ] }) : input.kind === 'transfer_policy' ? updatePlugin(umi, { asset: publicKey(input.asset!), plugin: { type: 'PermanentFreezeDelegate', frozen: !input.allowTransfers } }) : transfer(umi, { asset: { publicKey: publicKey(input.asset!), owner: publicKey(input.wallet) }, newOwner: publicKey(input.recipient!) })
  const tx = new Transaction({ feePayer: new PublicKey(input.wallet), recentBlockhash: input.blockhash }).add(...builder.getInstructions().map(toWeb3JsInstruction), memo(input.id))
  if (signer) tx.partialSign(Keypair.fromSecretKey(signer.secretKey))
  return { tx, asset: signer ? String(signer.publicKey) : input.asset! }
}
