import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadEnv } from 'dotenv'

const root = resolve(import.meta.dirname, '../..')
const required = [
  'SURF_API_KEY', 'DATABASE_URL', 'ADMIN_TOKEN', 'PAY_ORIGIN_TOKEN',
  'PAY_GATEWAY_SIGNER_WALLET', 'OPERATOR_KEYPAIR_PATH', 'SOLANA_RPC_URL',
] as const

export function validateDemoConfig(env: NodeJS.ProcessEnv): string[] {
  const errors: string[] = []
  for (const key of required) {
    if (!env[key]?.trim()) errors.push(key + ' is required')
  }
  if (env.DEEP_RESEARCH_ENABLED !== 'true') errors.push('DEEP_RESEARCH_ENABLED=true is required')
  if (env.PAY_GATEWAY_ENABLED !== 'true') errors.push('PAY_GATEWAY_ENABLED=true is required')
  if (env.PAY_DEMO_BUY_ENABLED !== 'true') errors.push('PAY_DEMO_BUY_ENABLED=true is required for the UI demo')
  if (env.PAY_MODE !== 'sandbox') errors.push('PAY_MODE=sandbox is required')
  if ((env.RESEARCH_HOST || '127.0.0.1') !== '127.0.0.1' ||
      (env.RESEARCH_PORT || '4174') !== '4174') {
    errors.push('This demo launcher requires the research sidecar on 127.0.0.1:4174')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(env.REPORT_ENC_KEY || '')) {
    errors.push('REPORT_ENC_KEY must be 32 bytes of hex')
  }
  if ((env.PAY_ORIGIN_TOKEN || '').length < 32) errors.push('PAY_ORIGIN_TOKEN must be at least 32 characters')
  try {
    const gateway = new URL(env.PAY_GATEWAY_URL || 'http://127.0.0.1:1402')
    if (gateway.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost'].includes(gateway.hostname) ||
        gateway.port !== '1402' || gateway.pathname !== '/' ||
        gateway.username || gateway.password || gateway.search || gateway.hash) {
      errors.push('PAY_GATEWAY_URL must be local HTTP port 1402')
    }
  } catch {
    errors.push('PAY_GATEWAY_URL must be a valid local URL')
  }
  return errors
}

const children: Array<{ name: string; process: ChildProcess }> = []
let stopping = false

function relay(name: string, stream: NodeJS.ReadableStream | null, destination: NodeJS.WriteStream) {
  if (!stream) return
  let pending = ''
  stream.on('data', (chunk: Buffer) => {
    pending += chunk.toString('utf8')
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() || ''
    for (const line of lines) if (line.trim()) destination.write('[' + name + '] ' + line + '\n')
  })
  stream.on('end', () => {
    if (pending.trim()) destination.write('[' + name + '] ' + pending + '\n')
  })
}

function start(name: string, args: string[]): ChildProcess {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push({ name, process: child })
  relay(name, child.stdout, process.stdout)
  relay(name, child.stderr, process.stderr)
  child.on('error', (error) => {
    if (!stopping) {
      process.stderr.write('[demo] ' + name + ' could not start: ' + error.message + '\n')
      void shutdown(1)
    }
  })
  child.on('exit', (code) => {
    if (!stopping) {
      process.stderr.write('[demo] ' + name + ' exited before the demo ended (code ' + code + ').\n')
      void shutdown(1)
    }
  })
  return child
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return
  if (process.platform !== 'win32') {
    child.kill('SIGTERM')
    return
  }
  await new Promise<void>((done) => {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true, stdio: 'ignore',
    })
    killer.once('error', () => done())
    killer.once('exit', () => done())
  })
}

async function shutdown(code: number) {
  if (stopping) return
  stopping = true
  await Promise.allSettled(children.reverse().map(({ process: child }) => stopChild(child)))
  process.exitCode = code
}

function command(args: string[]): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: process.env, windowsHide: true, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? done() : reject(new Error('Migration failed; check DATABASE_URL and the dr_ schema')))
  })
}

async function assertPortFree(port: number) {
  const probe = createServer()
  await new Promise<void>((done, reject) => {
    probe.once('error', reject)
    probe.listen(port, '127.0.0.1', done)
  })
  await new Promise<void>((done) => probe.close(() => done()))
}

async function waitFor(name: string, url: string, child: ChildProcess, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && !stopping) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(name + ' exited during startup')
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return
    } catch { /* service is still starting */ }
    await new Promise((done) => setTimeout(done, 1_000))
  }
  throw new Error(name + ' did not become ready')
}

async function main() {
  loadEnv({ path: resolve(root, '.env.local'), quiet: true })
  const errors = validateDemoConfig(process.env)
  if (process.env.OPERATOR_KEYPAIR_PATH && !existsSync(resolve(root, process.env.OPERATOR_KEYPAIR_PATH))) {
    errors.push('OPERATOR_KEYPAIR_PATH does not exist')
  }
  if (errors.length) {
    process.stderr.write('[demo] Setup required:\n' + errors.map((error) => '  - ' + error).join('\n') + '\n')
    process.exitCode = 1
    return
  }
  try {
    for (const port of [4174, 1402, 5173]) await assertPortFree(port)
  } catch {
    process.stderr.write('[demo] Ports 4174, 1402, and 5173 must be free before starting the demo.\n')
    process.exitCode = 1
    return
  }

  try {
    process.stdout.write('[demo] Applying additive dr_ migration...\n')
    await command([resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'scripts/research/migrate.ts'])
    if (stopping) return
    const research = start('research', [resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'scripts/research/server.ts'])
    await waitFor('Research sidecar', 'http://127.0.0.1:4174/health', research, 30_000)
    const templates = await fetch('http://127.0.0.1:4174/templates', { signal: AbortSignal.timeout(8_000) })
    if (!templates.ok) throw new Error('Research templates are unavailable after migration')
    const gateway = start('pay.sh', [resolve(root, 'scripts/research/pay-sandbox.mjs')])
    await waitFor('pay.sh sandbox gateway', 'http://127.0.0.1:1402/__402/health', gateway, 120_000)
    const vite = start('vite', [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'])
    await waitFor('Vite', 'http://127.0.0.1:5173/scex', vite, 30_000)
    process.stdout.write('[demo] Ready: http://127.0.0.1:5173/scex\n')
    process.stdout.write('[demo] Select a live KOL, open Deep Research, and choose the local sandbox buyer. Press Ctrl+C to stop all three services.\n')
  } catch (cause) {
    if (stopping) return
    process.stderr.write('[demo] ' + (cause instanceof Error ? cause.message : 'Startup failed') + '\n')
    await shutdown(1)
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.on('SIGINT', () => { void shutdown(0) })
  process.on('SIGTERM', () => { void shutdown(0) })
  void main()
}
