/**
 * Unified ops CLI for KOL Radar.
 *
 *   node scripts/radar.mjs health
 *   node scripts/radar.mjs push followers --handle hakresearch --type recent --file data.json
 *   node scripts/radar.mjs hide kol --handle somehandle
 *   node scripts/radar.mjs hide kol --handle somehandle --unhide
 *   node scripts/radar.mjs refresh feed
 *   node scripts/radar.mjs refresh scex
 *
 * Legacy shortcuts (spawn old one-shot scripts):
 *   node scripts/radar.mjs push followers --handle thienthien1305 --type recent
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiBase, loadRadarEnv, requireToken } from './lib/loadEnv.mjs'
import {
  fetchHealth,
  hideKol,
  parseArgs,
  parseFollowerFile,
  pushFollowers,
} from './lib/radarOps.mjs'

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
  node scripts/radar.mjs health
  node scripts/radar.mjs push followers --handle <handle> --type recent|smart --file <json>
  node scripts/radar.mjs hide kol --handle <handle> [--unhide]
  node scripts/radar.mjs refresh feed
  node scripts/radar.mjs refresh scex

Follower JSON: an array of { handle, displayName, ... } or { followers: [...] }.
Without --file, known one-shot scripts still run for a few handles.
`)
}

function runScript(scriptName, extraArgs = []) {
  const scriptPath = path.join(ROOT, 'scripts', scriptName)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
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

function ageLabel(iso) {
  if (!iso) return 'no timestamp'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const days = (Date.now() - t) / 86400000
  if (days < 1) return `${Math.round(days * 24)}h ago`
  return `${days.toFixed(1)}d ago`
}

async function cmdHealth() {
  const token = (() => {
    try {
      return requireToken()
    } catch {
      return ''
    }
  })()
  const base = apiBase()
  console.log('GET health', base, token ? '(admin)' : '(public)')
  const rows = await fetchHealth(base, token)
  for (const r of rows) {
    if (!r.ok) {
      console.log(`  FAIL  ${r.id.padEnd(14)} ${r.status} ${r.error}`)
      continue
    }
    console.log(
      `  ok    ${r.id.padEnd(14)} ${ageLabel(r.timestamp).padEnd(12)} ${r.timestamp || ''}`,
    )
  }
  if (rows.some((r) => !r.ok)) process.exit(1)
}

async function cmdPushFollowers(flags) {
  const handle = flags.handle
  const type = flags.type
  const file = flags.file
  if (file) {
    const token = requireToken()
    const abs = path.isAbsolute(file) ? file : path.join(ROOT, file)
    const rows = parseFollowerFile(fs.readFileSync(abs, 'utf8'))
    const result = await pushFollowers({
      apiBase: apiBase(),
      token,
      handle,
      type: type || 'recent',
      rows,
      note: typeof flags.note === 'string' ? flags.note : undefined,
    })
    console.log(
      'PUT OK',
      `@${result.handle}`,
      result.type,
      result.count,
      'rows',
      result.put,
    )
    return
  }

  let scriptFile = flags.script ? KNOWN[flags.script] : null
  if (!scriptFile && handle && type) {
    scriptFile = KNOWN[`${normalizeLegacyHandle(handle)}-${type}`]
  }
  if (!scriptFile) {
    console.error(
      'Need --file <json>, or a known --handle/--type shortcut. Known:',
      Object.keys(KNOWN).join(', '),
    )
    usage()
    process.exit(1)
  }
  console.log(`→ ${scriptFile}`)
  await runScript(scriptFile)
}

function normalizeLegacyHandle(raw) {
  return String(raw || '')
    .replace(/^@/, '')
    .toLowerCase()
}

async function cmdHideKol(flags) {
  const token = requireToken()
  const result = await hideKol({
    apiBase: apiBase(),
    token,
    handle: flags.handle,
    unhide: flags.unhide === true,
    note: typeof flags.note === 'string' ? flags.note : undefined,
  })
  console.log(result.hidden ? 'HIDDEN' : 'UNHIDDEN', result.handle, result.put)
}

async function cmdRefresh(target, extra) {
  if (target === 'feed') {
    await runScript('refresh_feed_challenger_master.mjs', extra)
    return
  }
  if (target === 'scex') {
    await runScript('fetch_scex_blue_mentions_7d.mjs', ['--require-fetch', ...extra])
    await runScript('hydrate_scex_media.mjs', ['--put'])
    await runScript('recompute_scex_sentiments.mjs', ['--put'])
    return
  }
  usage()
  process.exit(1)
}

async function main() {
  loadRadarEnv()
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage()
    process.exit(cmd ? 0 : 0)
  }

  if (cmd === 'health') {
    await cmdHealth()
    return
  }

  if (cmd === 'push' && argv[1] === 'followers') {
    const { flags } = parseArgs(argv.slice(2))
    await cmdPushFollowers(flags)
    return
  }

  if (cmd === 'hide' && argv[1] === 'kol') {
    const { flags } = parseArgs(argv.slice(2))
    await cmdHideKol(flags)
    return
  }

  if (cmd === 'refresh') {
    const { flags, rest } = parseArgs(argv.slice(1))
    const target = rest[0]
    const extra = []
    if (flags['require-live'] || flags['require-live'] === true) {
      extra.push('--require-live')
    }
    await cmdRefresh(target, extra)
    return
  }

  usage()
  process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  if (e.body) console.error(e.body)
  process.exit(1)
})
