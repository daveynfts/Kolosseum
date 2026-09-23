import { readFile } from 'node:fs/promises'
import { config as loadEnv } from 'dotenv'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'

loadEnv({ path: '.env.local', quiet: true })
const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const keyPath = process.env.OPERATOR_KEYPAIR_PATH
if (!keyPath) throw new Error('OPERATOR_KEYPAIR_PATH is not configured')
const connection = new Connection(endpoint, 'confirmed')
if (await connection.getGenesisHash() !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') {
  throw new Error('Refusing airdrop: RPC is not Solana devnet')
}
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(keyPath, 'utf8')) as number[]))
let balance = await connection.getBalance(keypair.publicKey, 'confirmed')
if (balance < 0.01 * LAMPORTS_PER_SOL) {
  const signature = await connection.requestAirdrop(keypair.publicKey, 0.05 * LAMPORTS_PER_SOL)
  await connection.confirmTransaction(signature, 'confirmed')
  balance = await connection.getBalance(keypair.publicKey, 'confirmed')
}
process.stdout.write(`Devnet operator ${keypair.publicKey.toBase58()}: ${balance / LAMPORTS_PER_SOL} test SOL\n`)
