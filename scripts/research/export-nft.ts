import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { nftMetadata, premiumReport, publicBase } from '../../lib/payments/reportNft'
config({ path: '.env.local', quiet: true })
const report = await premiumReport(), base = publicBase()
await mkdir('public/demo/nft', { recursive: true }); await mkdir('public/demo/reports', { recursive: true })
await writeFile(`public/demo/reports/${report.contentHash}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
await writeFile(`public/demo/nft/${report.contentHash}.json`, JSON.stringify(nftMetadata(report, base), null, 2) + '\n', { flag: 'wx' })
console.log('Exported immutable-addressed report and Metaplex metadata. Publish both before accepting payment.')
