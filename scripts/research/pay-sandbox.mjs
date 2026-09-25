import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { Keypair } from '@solana/web3.js'

loadEnv({ path: '.env.local', quiet: true })

function fail(message) {
  process.stderr.write(message + '\n')
  process.exit(1)
}
if (process.env.PAY_MODE !== 'sandbox') fail('pay:sandbox requires PAY_MODE=sandbox')
if (process.env.DEEP_RESEARCH_ENABLED !== 'true' || process.env.PAY_GATEWAY_ENABLED !== 'true') {
  fail('Enable Deep Research and the gateway before accepting sandbox payments')
}
if (!process.env.PAY_ORIGIN_TOKEN || process.env.PAY_ORIGIN_TOKEN.length < 32) {
  fail('PAY_ORIGIN_TOKEN is missing or too short')
}
if (!process.env.DATABASE_URL || !process.env.SURF_API_KEY) {
  fail('DATABASE_URL and SURF_API_KEY are required before accepting sandbox payments')
}
if (!process.env.OPERATOR_KEYPAIR_PATH || !existsSync(process.env.OPERATOR_KEYPAIR_PATH)) {
  fail('OPERATOR_KEYPAIR_PATH is required for a fixed sandbox payout recipient')
}

try {
  const healthResponse = await fetch('http://127.0.0.1:4174/health', { signal: AbortSignal.timeout(10000) })
  if (!healthResponse.ok) fail('Research sidecar health check failed')
  const health = await healthResponse.json()
  if (health.surfAuthStatus !== 'valid') fail('Surf rejected the API key or authentication could not be checked; run npm run research:check-surf-auth before accepting payments')
  if (!health.enabled || !health.gatewayMode || !health.surfConfigured || !health.databaseConfigured) {
    fail('Research sidecar is not ready for paid sandbox requests')
  }
  const templatesResponse = await fetch('http://127.0.0.1:4174/templates', { signal: AbortSignal.timeout(8000) })
  if (!templatesResponse.ok) fail('Research templates are unavailable; run research:migrate first')
} catch {
  fail('Research sidecar is unreachable or its database is unavailable')
}
const env = { ...process.env }
try {
  const bytes = JSON.parse(readFileSync(process.env.OPERATOR_KEYPAIR_PATH, 'utf8'))
  env.PAY_RECIPIENT_WALLET = Keypair.fromSecretKey(Uint8Array.from(bytes)).publicKey.toBase58()
} catch {
  fail('OPERATOR_KEYPAIR_PATH does not contain a valid Solana keypair')
}
if (process.platform === 'win32') {
  const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === 'path')
  const systemPath = pathKeys.map((key) => env[key]).find(Boolean) || ''
  for (const key of pathKeys) delete env[key]
  const unzip = 'C:/Program Files/Git/usr/bin'
  env.Path = existsSync(join(unzip, 'unzip.exe')) ? unzip + ';' + systemPath : systemPath
}
const windows = process.platform === 'win32'
const child = spawn(
  windows ? (process.env.ComSpec || 'cmd.exe') : 'npx',
  windows
    ? ['/d', '/s', '/c', 'npx --yes @solana/pay@1.0.26 --sandbox gate api paywall.yml --bind 127.0.0.1:1402']
    : ['--yes', '@solana/pay@1.0.26', '--sandbox', 'gate', 'api', 'paywall.yml', '--bind', '127.0.0.1:1402'],
  { env, stdio: 'inherit' },
)
child.on('error', (error) => {
  process.stderr.write('Could not start pay.sh sandbox gateway: ' + error.message + '\n')
  process.exitCode = 1
})
child.on('exit', (code) => { process.exitCode = code ?? 1 })
