/**
 * Unified R2 publish CLI for KOL Radar.
 *
 *   node scripts/radar.mjs push followers --handle thienthien1305 --type recent
 *   node scripts/radar.mjs push followers --handle thienthien1305 --type smart
 *   node scripts/radar.mjs push followers --handle henvibta --type smart --script henvibta
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const KNOWN = {
  'thienthien1305-recent': 'push_thienthien1305_recent_followers.mjs',
  'thienthien1305-smart': 'push_thienthien1305_smart_followers.mjs',
  'hakresearch-recent': 'push_hakresearch_recent_followers.mjs',
  'henvaibta-smart': 'push_henvaibta_smart_followers.mjs',
  henvibta: 'push_henvaibta_smart_followers.mjs',
}

function usage() {
  console.log(`Usage:
  node scripts/radar.mjs push followers --handle <handle> --type recent|smart [--script alias]

Known shortcuts:
  ${Object.keys(KNOWN).join(', ')}
`)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--handle') out.handle = argv[++i]
    else if (a === '--type') out.type = argv[++i]
    else if (a === '--script') out.script = argv[++i]
  }
  return out
}

function runScript(scriptName) {
  const scriptPath = path.join(ROOT, 'scripts', scriptName)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      cwd: ROOT,
      env: process.env,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined)
      else reject(new Error(`${scriptName} exited ${code}`))
    })
  })
}

async function main() {
  const [cmd, sub, ...rest] = process.argv.slice(2)
  if (cmd !== 'push' || sub !== 'followers') {
    usage()
    process.exit(cmd ? 1 : 0)
  }

  const { handle, type, script } = parseArgs(rest)
  let scriptFile = script ? KNOWN[script] : null
  if (!scriptFile && handle && type) {
    scriptFile = KNOWN[`${handle.replace(/^@/, '').toLowerCase()}-${type}`]
  }
  if (!scriptFile) {
    console.error('Unknown handle/type — add a script in scripts/ or extend KNOWN in radar.mjs')
    usage()
    process.exit(1)
  }

  console.log(`→ ${scriptFile}`)
  await runScript(scriptFile)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
