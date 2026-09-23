import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Keypair } from '@solana/web3.js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

const envPath = resolve('.env.local')
const keyPath = resolve('.operator-keypair.local')
let keypair: Keypair
try {
  const existing = JSON.parse(await readFile(keyPath, 'utf8')) as number[]
  keypair = Keypair.fromSecretKey(Uint8Array.from(existing))
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  keypair = Keypair.generate()
  await writeFile(keyPath, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600, flag: 'wx' })
}

let existingEnv = ''
try { existingEnv = await readFile(envPath, 'utf8') } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}
const values: Record<string, string> = {
  DEEP_RESEARCH_ENABLED: 'true',
  RADAR_API_BASE: 'https://radar.daveynfts.com',
  SURF_API_BASE_URL: 'https://api.asksurf.ai/gateway',
  SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  OPERATOR_KEYPAIR_PATH: keyPath.replace(/\\/g, '/'),
  REPORT_ENC_KEY: randomBytes(32).toString('hex'),
  ADMIN_TOKEN: randomBytes(24).toString('base64url'),
  PAY_MODE: 'sandbox',
  PAY_GATEWAY_ENABLED: 'false',
  PAY_ORIGIN_TOKEN: randomBytes(32).toString('base64url'),
}
const missing = Object.entries(values).filter(([name]) => !new RegExp(`^${name}=`, 'm').test(existingEnv))
if (missing.length) {
  const suffix = `${existingEnv && !existingEnv.endsWith('\n') ? '\n' : ''}${missing.map(([name, value]) => `${name}=${value}`).join('\n')}\n`
  await writeFile(envPath, existingEnv + suffix, { mode: 0o600 })
}
process.stdout.write(`Local devnet operator: ${keypair.publicKey.toBase58()}\n`)
process.stdout.write(`Local configuration: ${missing.length} missing setting(s) added; no secrets printed.\n`)
