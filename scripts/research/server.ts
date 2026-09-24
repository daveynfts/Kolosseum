import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { decryptReport, hashesMatch, sha256 } from '../../lib/evidence/reportCrypto'
import { processEvidence, verifyEvidence } from '../../lib/evidence/memo'
import { generateDeepReport, generateQuickReport, normalizeDeepPrompt } from '../../lib/research/generate'
import { IncompleteDemoPurchaseError, runDemoBuyer, type DemoBuyerResult } from './demoBuy'
import { mayGenerateReport } from '../../lib/payments/originAuth'
import { parseBuyerWallet, verifyDashboardAccess, verifyReportAccess } from '../../lib/payments/walletAccess'
import { formatUsdc, verifyPaymentForReport } from '../../lib/payments/reconcile'
import { getBuyerDashboard, getReport, getResearchStats, getVoteSummary, listTemplates, recordPurchaseVote, recordReportPayment } from '../../lib/research/db'

loadEnv({ path: '.env.local', quiet: true })

const enabled = process.env.DEEP_RESEARCH_ENABLED === 'true'
const port = Number(process.env.RESEARCH_PORT || 4174)
const host = process.env.RESEARCH_HOST || '127.0.0.1'
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const reportPath = new RegExp(`^/reports/(${uuid})(?:/(verify))?$`, 'i')
const paymentPath = new RegExp(`^/reports/(${uuid})/payment$`, 'i')
const votePath = new RegExp(`^/reports/(${uuid})/vote$`, 'i')
const demoBuyEnabled = process.env.PAY_DEMO_BUY_ENABLED === 'true' &&
  process.env.PAY_MODE === 'sandbox' && process.env.PAY_GATEWAY_ENABLED === 'true' &&
  (host === '127.0.0.1' || host === 'localhost') && process.platform === 'win32'
let demoPurchaseBusy = false
let latestDemoPurchase: ({ status: 'running' | 'failed' | 'needs-review' | 'verified'; reportId?: string } &
  Partial<DemoBuyerResult>) | null = null

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(data))
}

function isAdmin(req: IncomingMessage): boolean {
  const configured = process.env.ADMIN_TOKEN
  if (!configured || configured === 'change-me-long-secret') return false
  const candidate = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1] || ''
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(configured).digest()
  return timingSafeEqual(a, b)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('Expected application/json')
  let body = ''
  for await (const chunk of req) {
    body += chunk.toString('utf8')
    if (body.length > 16_384) throw new Error('Request body too large')
  }
  const parsed = JSON.parse(body) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected JSON object')
  return parsed as Record<string, unknown>
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', `http://${host}:${port}`).pathname
  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, {
      enabled,
      gatewayMode: process.env.PAY_GATEWAY_ENABLED === 'true',
      demoBuyEnabled,
      radarConfigured: Boolean(process.env.RADAR_API_BASE || 'https://radar.daveynfts.com'),
      surfConfigured: Boolean(process.env.SURF_API_KEY),
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      evidenceConfigured: Boolean(process.env.OPERATOR_KEYPAIR_PATH),
    })
  }
  if (!enabled) return send(res, 404, { error: 'Deep Research is disabled' })

  try {
    if (req.method === 'GET' && pathname === '/templates') {
      const templates = (await listTemplates()).map(({ prompt_system: _system, prompt_user: _user, ...publicFields }) => publicFields)
      return send(res, 200, { templates })
    }
    if (req.method === 'GET' && pathname === '/me') {
      const wallet = verifyDashboardAccess(req.headers)
      if (!wallet) return send(res, 401, { error: 'Recent buyer wallet signature required' })
      return send(res, 200, await getBuyerDashboard(wallet))
    }
    if (req.method === 'GET' && pathname === '/research/demo-buy/latest') {
      if (!demoBuyEnabled) return send(res, 404, { error: 'Local sandbox buyer is disabled' })
      if (!isAdmin(req)) return send(res, 401, { error: 'Admin token required' })
      return latestDemoPurchase
        ? send(res, 200, latestDemoPurchase)
        : send(res, 404, { error: 'No local demo purchase has run in this server session' })
    }
    if (req.method === 'POST' && pathname === '/research/demo-buy') {
      if (!demoBuyEnabled) return send(res, 404, { error: 'Local sandbox buyer is disabled' })
      if (!isAdmin(req)) return send(res, 401, { error: 'Admin token required' })
      if (demoPurchaseBusy) return send(res, 409, { error: 'A sandbox demo purchase is already running' })
      const body = await readJson(req)
      if (typeof body.kolHandle !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(body.kolHandle)) {
        return send(res, 400, { error: 'Valid X handle is required' })
      }
      if ((body.prompt !== undefined && typeof body.prompt !== 'string') ||
          (body.templateSlug !== undefined && typeof body.templateSlug !== 'string')) {
        return send(res, 400, { error: 'Template and prompt must be strings' })
      }
      const isDeep = typeof body.prompt === 'string'
      if (isDeep === (typeof body.templateSlug === 'string')) {
        return send(res, 400, { error: 'Choose exactly one template or custom prompt' })
      }
      if (!process.env.SURF_API_KEY || !process.env.DATABASE_URL) {
        return send(res, 503, { error: 'Live Surf and database connections are required' })
      }
      let input: { kolHandle: string; templateSlug?: string; prompt?: string }
      if (isDeep) {
        input = { kolHandle: body.kolHandle, prompt: normalizeDeepPrompt(body.prompt as string) }
      } else {
        const templateSlug = body.templateSlug as string
        if (!(await listTemplates()).some((template) => template.slug === templateSlug)) {
          return send(res, 400, { error: 'Unknown or disabled template' })
        }
        input = { kolHandle: body.kolHandle, templateSlug }
      }
      if (demoPurchaseBusy) return send(res, 409, { error: 'A sandbox demo purchase is already running' })
      demoPurchaseBusy = true
      latestDemoPurchase = { status: 'running' }
      try {
        const result = await runDemoBuyer(input)
        latestDemoPurchase = { status: 'verified', ...result }
        return send(res, 201, { ...latestDemoPurchase, reportUrl: '/reports/' + result.reportId })
      } catch (cause) {
        if (cause instanceof IncompleteDemoPurchaseError) {
          latestDemoPurchase = { status: 'needs-review', reportId: cause.reportId }
          return send(res, 202, { ...latestDemoPurchase,
            reportUrl: '/reports/' + cause.reportId,
            error: 'A sandbox purchase may have occurred. Inspect this report before trying again.' })
        }
        latestDemoPurchase = { status: 'failed' }
        return send(res, 502, { error: 'Local sandbox buyer could not complete a verified report' })
      } finally {
        demoPurchaseBusy = false
      }
    }
    if (req.method === 'POST' && pathname === '/research/quick') {
      if (!mayGenerateReport(req.headers)) return send(res, 401, { error: 'Research origin authorization required' })
      const body = await readJson(req)
      if (typeof body.kolHandle !== 'string' || typeof body.templateSlug !== 'string') {
        return send(res, 400, { error: 'kolHandle and templateSlug are required' })
      }
      const buyerWallet = process.env.PAY_GATEWAY_ENABLED === 'true' ? parseBuyerWallet(body.buyerWallet) : null
      const report = await generateQuickReport(body.kolHandle, body.templateSlug, buyerWallet)
      let evidence: { status: string; signature: string | null } = { status: 'pending', signature: null }
      if (process.env.OPERATOR_KEYPAIR_PATH && process.env.SOLANA_RPC_URL) {
        try { evidence = await processEvidence(report.id) } catch { /* worker can retry */ }
      }
      return send(res, 201, {
        reportId: report.id,
        reportUrl: `/reports/${report.id}`,
        contentHash: report.contentHash,
        content: report.content,
        evidence,
        surfUsage: report.surfUsage,
        chargedUsdc: process.env.PAY_GATEWAY_ENABLED === 'true' ? null : '0',
      })
    }
    if (req.method === 'POST' && pathname === '/research/deep') {
      if (!mayGenerateReport(req.headers)) return send(res, 401, { error: 'Research origin authorization required' })
      const body = await readJson(req)
      if (typeof body.kolHandle !== 'string' || typeof body.prompt !== 'string') {
        return send(res, 400, { error: 'kolHandle and prompt are required' })
      }
      const buyerWallet = process.env.PAY_GATEWAY_ENABLED === 'true' ? parseBuyerWallet(body.buyerWallet) : null
      const report = await generateDeepReport(body.kolHandle, body.prompt, buyerWallet)
      let evidence: { status: string; signature: string | null } = { status: 'pending', signature: null }
      if (process.env.OPERATOR_KEYPAIR_PATH && process.env.SOLANA_RPC_URL) {
        try { evidence = await processEvidence(report.id) } catch { /* worker can retry */ }
      }
      return send(res, 201, {
        reportId: report.id,
        reportUrl: '/reports/' + report.id,
        contentHash: report.contentHash,
        content: report.content,
        evidence,
        surfUsage: report.surfUsage,
      })
    }
    const paymentMatch = paymentPath.exec(pathname)
    if (paymentMatch && req.method === 'POST') {
      if (process.env.PAY_GATEWAY_ENABLED !== 'true') return send(res, 404, { error: 'Paid research is disabled' })
      const report = await getReport(paymentMatch[1])
      if (!report) return send(res, 404, { error: 'Report not found' })
      if (!isAdmin(req) && !verifyReportAccess(req.headers, report.id, report.buyer_wallet)) {
        return send(res, 401, { error: 'Report owner signature or admin token required' })
      }
      const body = await readJson(req)
      if ((body.protocol !== 'mpp-session' && body.protocol !== 'x402-upto') ||
          typeof body.receipt !== 'string' || body.receipt.length > 4096) {
        return send(res, 400, { error: 'Valid protocol and receipt are required' })
      }
      const payment = await verifyPaymentForReport(report, { protocol: body.protocol, receipt: body.receipt })
      if (!payment.settled) {
        return send(res, 202, {
          status: 'pending-settlement', channelId: payment.channel?.id,
          onChainSpentUsdc: payment.channel ? formatUsdc(payment.channel.spentBaseUnits) : null,
        })
      }
      const saved = await recordReportPayment(report.id, report.buyer_wallet!, payment)
      return send(res, 200, {
        status: 'verified', protocol: payment.protocol, paymentRef: saved.payment_ref,
        priceChargedUsdc: saved.price_charged, channel: payment.channel ? {
          id: payment.channel.id, status: payment.channel.status,
          capUsdc: formatUsdc(payment.channel.capBaseUnits),
          spentUsdc: formatUsdc(payment.channel.spentBaseUnits),
          remainingUsdc: formatUsdc(payment.channel.remainingBaseUnits),
        } : null,
      })
    }
    const voteMatch = votePath.exec(pathname)
    if (voteMatch && req.method === 'POST') {
      if (process.env.PAY_GATEWAY_ENABLED !== 'true') return send(res, 404, { error: 'Purchase-backed voting is disabled' })
      const report = await getReport(voteMatch[1])
      if (!report) return send(res, 404, { error: 'Report not found' })
      if (!verifyReportAccess(req.headers, report.id, report.buyer_wallet)) {
        return send(res, 401, { error: 'Buyer wallet signature required' })
      }
      const body = await readJson(req)
      if (body.value !== 1 && body.value !== -1) return send(res, 400, { error: 'Vote value must be +1 or -1' })
      const vote = await recordPurchaseVote(report.id, report.buyer_wallet!, body.value)
      if (!vote) return send(res, 402, { error: 'Verified purchase required to vote' })
      return send(res, 200, { ...vote, summary: await getVoteSummary(report.id) })
    }
    const match = reportPath.exec(pathname)
    if (match && req.method === 'GET') {
      const report = await getReport(match[1])
      if (!report) return send(res, 404, { error: 'Report not found' })
      const key = process.env.REPORT_ENC_KEY
      if (!key) return send(res, 503, { error: 'Report encryption key is not configured' })
      const content = decryptReport(report.content_encrypted, key)
      const hashMatch = hashesMatch(sha256(content), report.content_hash)
      if (match[2] === 'verify') {
        let onChainMatch: boolean | null = null
        let networkError = false
        if (report.evidence_tx) {
          try { onChainMatch = await verifyEvidence(report) } catch { networkError = true }
        }
        return send(res, 200, {
          reportId: report.id, kolHandle: report.kol_ref, templateSlug: report.template_slug,
          contentHash: report.content_hash, recomputedHashMatch: hashMatch,
          paymentRequired: process.env.PAY_GATEWAY_ENABLED === 'true',
          paymentVerified: Boolean(report.payment_ref), priceChargedUsdc: report.price_charged,
          evidenceTx: report.evidence_tx, onChainMatch, networkError,
          votes: await getVoteSummary(report.id),
          explorerUrl: report.evidence_tx
            ? `https://explorer.solana.com/tx/${report.evidence_tx}?cluster=devnet` : null,
        })
      }
      if (!isAdmin(req) && !(process.env.PAY_GATEWAY_ENABLED === 'true' &&
        verifyReportAccess(req.headers, report.id, report.buyer_wallet))) {
        return send(res, 401, { error: 'Wallet signature or admin token required' })
      }
      if (process.env.PAY_GATEWAY_ENABLED === 'true' && !report.payment_ref && !isAdmin(req)) {
        return send(res, 402, { error: 'Settled payment proof required to reopen report' })
      }
      if (!hashMatch) return send(res, 409, { error: 'Stored report hash mismatch' })
      return send(res, 200, {
        id: report.id, kolHandle: report.kol_ref, templateSlug: report.template_slug,
        content, contentHash: report.content_hash, evidenceTx: report.evidence_tx,
        contextAsOf: report.context_as_of, createdAt: report.created_at,
        surfModel: report.surf_model, surfUsage: report.surf_usage,
        paymentRef: report.payment_ref, priceChargedUsdc: report.price_charged,
        buyerWallet: report.buyer_wallet,
      })
    }
    if (req.method === 'GET' && pathname === '/research/admin/stats') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Admin token required' })
      return send(res, 200, await getResearchStats())
    }
    if (req.method === 'POST' && pathname === '/research/evidence/run') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Admin token required' })
      const body = await readJson(req)
      if (typeof body.reportId !== 'string' || !reportPath.test(`/reports/${body.reportId}`)) {
        return send(res, 400, { error: 'Valid reportId required' })
      }
      return send(res, 200, await processEvidence(body.reportId))
    }
    send(res, 404, { error: 'Route not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = /Invalid X handle|Expected |too large|Unknown or disabled template|Unexpected token|Prompt must|Trading recommendations|Valid buyerWallet|receipt|payment channel|price mismatch|payer does not match|buyer does not match|requires an MPP|requires an x402/i.test(message) ? 400 :
      /not configured|Radar API|DATABASE_URL/.test(message) ? 503 :
      /already has a different payment|duplicate key/.test(message) ? 409 : 502
    // Do not echo provider bodies, keys or prompts in HTTP errors or logs.
    send(res, status, { error: status === 400 ? message : 'Research service unavailable', code: status })
  }
})

server.listen(port, host, () => {
  process.stdout.write(`Research sidecar listening on http://${host}:${port}\n`)
})
