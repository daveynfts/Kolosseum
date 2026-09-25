import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { decryptReport, hashesMatch, sha256 } from '../../lib/evidence/reportCrypto'
import { verifyEvidence } from '../../lib/evidence/memo'
import { formatUsdc, parseUsdc } from '../../lib/payments/reconcile'
import { getBuyerDashboard, getPool, getReport, getTemplate, getVoteSummary } from '../../lib/research/db'
import { signDemoCapture, type DemoCapture } from '../../lib/research/demoReplay'
import { loadKolContext } from '../../lib/research/kolContext'
import type { ScexDataset } from '../../src/data/scexTracking'

loadEnv({ path: '.env.local', quiet: true })

async function record(): Promise<void> {
  const surfAuthInvalid = process.argv.includes('--surf-auth-invalid') || process.argv.includes('--surf-chat-401')
  const reportFlag = process.argv.indexOf('--report')
  const reportId = reportFlag >= 0 ? process.argv[reportFlag + 1] : null
  const outputFlag = process.argv.indexOf('--output')
  const captureDirectory = resolve('.demo-captures')
  const destination = outputFlag >= 0 ? resolve(process.argv[outputFlag + 1] || '') : resolve('.demo-captures/flow.json')
  if (!destination.startsWith(captureDirectory + sep) || !destination.endsWith('.json')) {
    throw new Error('Demo output must be a JSON file within .demo-captures')
  }
  if (reportFlag >= 0 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId || '')) {
    throw new Error('Use --report followed by a report UUID')
  }
  const response = await fetch(new URL('/api/scex-tracking', process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'), {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('Radar SCEX feed is unavailable')
  const dataset = await response.json() as ScexDataset
  if (!Array.isArray(dataset.actors) || !Array.isArray(dataset.posts)) throw new Error('Invalid Radar SCEX feed')
  const kols = new Set(dataset.actors.filter((actor) => actor.kind === 'kol').map((actor) => actor.handle.toLowerCase()))
  const counts = new Map<string, number>()
  for (const post of dataset.posts) {
    const handle = post.handle.toLowerCase()
    if (kols.has(handle)) counts.set(handle, (counts.get(handle) || 0) + 1)
  }
  const ranking = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const [topHandle, topPostCount] = ranking[0] || []
  if (!topHandle || !topPostCount) throw new Error('No KOL posts in the SCEX feed')
  const context = await loadKolContext(topHandle, { postLimit: 20 })
  const template = await getTemplate('exchange-stance')
  if (!template) throw new Error('Exchange stance template is unavailable')
  const capturedAt = new Date().toISOString()
  const capture: DemoCapture = {
    version: 1,
    signature: '',
    recordedAt: capturedAt,
    status: 'source-ready',
    limitation: surfAuthInvalid
      ? 'Surf gateway rejected the saved API key (HTTP 401 UNAUTHORIZED). No report or purchase has been recorded.'
      : 'No real report has been recorded yet; research, payment, and evidence stages are pending.',
    steps: [
      { name: 'Radar source', status: 'verified', detail: `${dataset.posts.length} SCEX posts; source as of ${dataset.asOf}.` },
      { name: 'Top KOL selected', status: 'verified', detail: `@${topHandle} has ${topPostCount} SCEX posts in this snapshot.` },
      { name: 'Research quote', status: 'verified', detail: `${template.title}: $${template.price_usdc} sandbox USDC.` },
      { name: 'Surf report', status: surfAuthInvalid ? 'blocked' : 'pending', detail: surfAuthInvalid
        ? 'Authenticated Surf requests returned HTTP 401: invalid API key.' : 'Awaiting one successful real Surf Chat report.' },
      { name: 'Encrypted report and SHA-256', status: 'pending', detail: 'Waiting for a successful Surf response.' },
      { name: 'Sandbox purchase and receipt', status: 'pending', detail: 'No sandbox purchase was made for an unavailable report.' },
      { name: 'Devnet Memo', status: 'pending', detail: 'No report hash exists to anchor yet.' },
    ],
    source: {
      asOf: dataset.asOf,
      updatedAt: dataset.updatedAt || null,
      actorCount: dataset.actors.length,
      postCount: dataset.posts.length,
      topKolPostCount: topPostCount,
    },
    kol: {
      handle: context.actor.handle,
      displayName: context.actor.displayName,
      followers: context.actor.followers,
      qualityScore: context.actor.qualityScore,
      postsVolume: context.actor.postsVolume,
      matrix: { x: context.matrix.x, y: context.matrix.y },
    },
    posts: context.posts.map(({ id, url, text, postedAt }) => ({ id, url, text, postedAt })),
    template: {
      slug: template.slug,
      title: template.title,
      description: template.description,
      priceUsdc: template.price_usdc,
    },
    report: null,
    payment: null,
    verification: null,
  }

  if (reportId) {
    const report = await getReport(reportId)
    if (!report) throw new Error('Report not found')
    if (report.kol_ref.toLowerCase() !== topHandle) throw new Error('Report is not for the top SCEX KOL')
    if (report.template_slug === null) {
      capture.template = {
        slug: 'custom-deep',
        title: 'Custom deep research',
        description: 'Buyer-defined, source-backed research angle.',
        priceUsdc: '1.00',
      }
      capture.steps[2] = {
        name: 'Research quote',
        status: 'verified',
        detail: 'x402 upto capped at $1.00 sandbox USDC; settled $' + report.price_charged + '.',
      }
    }
    const key = process.env.REPORT_ENC_KEY
    if (!key) throw new Error('REPORT_ENC_KEY is required')
    const plaintext = decryptReport(report.content_encrypted, key)
    const hashMatch = hashesMatch(sha256(plaintext), report.content_hash)
    if (!hashMatch) throw new Error('Stored report hash does not match')
    let onChainMatch: boolean | null = null
    if (report.evidence_tx) {
      try { onChainMatch = await verifyEvidence(report) } catch { onChainMatch = null }
    }
    const votes = await getVoteSummary(report.id)
    capture.report = {
      id: report.id,
      contentEncrypted: report.content_encrypted,
      contentHash: report.content_hash,
      promptHash: report.prompt_hash,
      surfModel: report.surf_model,
      surfUsage: {
        creditsUsed: report.surf_usage.creditsUsed,
        cacheHit: report.surf_usage.cacheHit,
        creditsSource: report.surf_usage.creditsSource,
      },
      createdAt: report.created_at.toISOString(),
      contextAsOf: report.context_as_of?.toISOString() || null,
    }
    capture.verification = {
      hashMatch,
      onChainMatch,
      evidenceTx: report.evidence_tx,
      explorerUrl: report.evidence_tx ? `https://explorer.solana.com/tx/${report.evidence_tx}?cluster=devnet` : null,
      votes,
    }
    capture.status = 'report-ready'
    capture.limitation = 'This snapshot contains a real private report; a sandbox purchase has not been verified.'
    capture.steps[3] = { name: 'Surf report', status: 'verified', detail: report.surf_usage.cacheHit ? 'Encrypted Surf result reused from cache; 0 new credits.' : report.surf_model + ' completed; ' + (report.surf_usage.creditsUsed ?? 'unknown') + ' credits (' + (report.surf_usage.creditsSource ?? 'unknown source') + ').' }
    capture.steps[4] = { name: 'Encrypted report and SHA-256', status: 'verified', detail: `Stored report ${report.id}; SHA-256 matches.` }
    capture.steps[6] = report.evidence_tx && onChainMatch
      ? { name: 'Devnet Memo', status: 'verified', detail: 'The report hash was verified on Solana devnet at capture time.' }
      : { name: 'Devnet Memo', status: 'pending', detail: 'Memo is pending or was not verifiable at capture time.' }

    if (report.payment_ref && report.buyer_wallet) {
      const dashboard = await getBuyerDashboard(report.buyer_wallet)
      const protocol = report.template_slug ? 'mpp-session' : 'x402-upto'
      const found = protocol === 'mpp-session'
        ? dashboard.channels.find((row) => report.payment_ref?.startsWith(`mpp:${row.channel_id}:`)) : undefined
      capture.payment = {
        protocol,
        buyerWallet: report.buyer_wallet,
        paymentRef: report.payment_ref,
        priceChargedUsdc: report.price_charged,
        channel: found ? {
          id: found.channel_id,
          capUsdc: found.cap_usdc,
          spentUsdc: found.spent_usdc,
          remainingUsdc: formatUsdc(parseUsdc(found.cap_usdc) - parseUsdc(found.spent_usdc)),
          status: found.status,
        } : null,
      }
      capture.steps[5] = { name: 'Sandbox purchase and receipt', status: 'verified', detail: `${protocol} receipt reconciled on sandbox chain; $${report.price_charged} USDC charged.` }
      if (onChainMatch) {
        capture.status = 'purchase-verified'
        capture.limitation = null
      } else {
        capture.limitation = 'Sandbox payment was verified, but the devnet Memo was pending or unavailable at capture time.'
      }
    }
  }
  const captureKey = process.env.REPORT_ENC_KEY
  if (!captureKey) throw new Error('REPORT_ENC_KEY is required for a signed capture')
  capture.signature = signDemoCapture(capture, captureKey)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, JSON.stringify(capture, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  process.stdout.write(JSON.stringify({ path: destination, status: capture.status, topKol: topHandle,
    topPosts: topPostCount, reportId: capture.report?.id || null, paymentVerified: Boolean(capture.payment),
    memoVerified: capture.verification?.onChainMatch === true }) + '\n')
}

try {
  await record()
} finally {
  await getPool().end()
}
