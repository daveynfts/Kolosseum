import { config } from 'dotenv'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createGenericFile, createGenericFileFromJson, keypairIdentity } from '@metaplex-foundation/umi'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { devnet, nftMetadata, premiumReport } from '../../lib/payments/reportNft'
import { sha256 } from '../../lib/evidence/reportCrypto'
config({ path: '.env.local', quiet: true })
const report = await premiumReport(), connection = await devnet()
const umi = createUmi(connection.rpcEndpoint).use(irysUploader({ address: 'https://devnet.irys.xyz', providerUrl: connection.rpcEndpoint, timeout: 60_000 }))
const secret = Uint8Array.from(JSON.parse(await readFile(process.env.OPERATOR_KEYPAIR_PATH!, 'utf8')))
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secret)))
const stageFile = `.demo-captures/nft-upload-${report.contentHash}.json`
await mkdir('.demo-captures', { recursive: true })
let stage: { imageUri?: string; reportUri?: string; metadataUri?: string } = {}
try { stage = JSON.parse(await readFile(stageFile, 'utf8')) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
async function save() { await writeFile(stageFile, JSON.stringify(stage)) }
async function upload(file: ReturnType<typeof createGenericFile>) {
  const price = await umi.uploader.getUploadPrice([file])
  if (price.basisPoints > 1_000_000n) throw new Error('Storage estimate exceeds 0.001 Devnet SOL per file')
  return (await umi.uploader.upload([file]))[0]
}
if (!stage.imageUri) { stage.imageUri = await upload(createGenericFile(await readFile('public/arena/loading/01-rome-960.webp'), 'surfai.webp', { contentType: 'image/webp' })); await save() }
if (!stage.reportUri) { stage.reportUri = await upload(createGenericFileFromJson(report)); await save() }
const metadata = nftMetadata(report, 'https://radar.daveynfts.com')
metadata.image = stage.imageUri; metadata.properties.report_uri = stage.reportUri; metadata.properties.files = [{ uri: stage.reportUri, type: 'application/json' }]
if (!stage.metadataUri) { stage.metadataUri = await upload(createGenericFileFromJson(metadata)); await save() }
await writeFile('public/demo/nft-storage.json', JSON.stringify({ ...stage, contentHash: report.contentHash, metadataHash: sha256(JSON.stringify(metadata)), storage: 'irys-devnet', uploadedAt: new Date().toISOString(), note: 'Devnet storage is for testing; migrate to durable storage before a mainnet launch.' }, null, 2) + '\n')
console.log(JSON.stringify({ metadataUri: stage.metadataUri, reportUri: stage.reportUri, storage: 'irys-devnet' }))
