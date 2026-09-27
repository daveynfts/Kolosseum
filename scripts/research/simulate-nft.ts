import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import { buildNftTransaction, devnet } from '../../lib/payments/reportNft'
config({ path: '.env.local', quiet: true })
// Simulation only: no signing with the operator, no broadcast and no purchase.
const buyer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(process.env.OPERATOR_KEYPAIR_PATH!, 'utf8')))).publicKey.toBase58()
const connection = await devnet(), latest = await connection.getLatestBlockhash()
const { tx, asset } = buildNftTransaction({ buyer, recipient: Keypair.generate().publicKey.toBase58(), uri: 'https://example.com/report.json', id: '00000000-0000-4000-8000-000000000001', contentHash: 'a'.repeat(64), handle: 'luong4101992', lamports: '8000000', blockhash: latest.blockhash, rpc: connection.rpcEndpoint })
const versioned = VersionedTransaction.deserialize(tx.serialize({ requireAllSignatures: false }))
const result = await connection.simulateTransaction(versioned, { sigVerify: false, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: [asset] } })
if (result.value.err) { console.log(JSON.stringify({ error: result.value.err, logs: result.value.logs })); throw new Error('Atomic NFT transaction simulation failed') }
console.log(JSON.stringify({ status: 'PASS', network: 'devnet', computeUnits: result.value.unitsConsumed, simulatedAssetBytes: Buffer.from(result.value.accounts![0]!.data[0], 'base64').length, transactionBytes: tx.serialize({ requireAllSignatures: false }).length, broadcast: false }))
