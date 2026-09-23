import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { decryptReport, hashesMatch, sha256 } from '../../lib/evidence/reportCrypto'
import { processEvidence, verifyEvidence } from '../../lib/evidence/memo'
import { generateDeepReport, generateQuickReport } from '../../lib/research/generate'
import { mayGenerateReport } from '../../lib/payments/originAuth'
import { getReport, getResearchStats, listTemplates } from '../../lib/research/db'

loadEnv({ path: '.env.local', quiet: true })

const enabled = process.env.DEEP_RESEARCH_ENABLED === 'true'
const port = Number(process.env.RESEARCH_PORT || 4174)
const host = process.env.RESEARCH_HOST || '127.0.0.1'
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const reportPath = new RegExp(`^/reports/(${uuid})(?:/(verify))?$`, 'i')

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
    if (req.method === 'POST' && pathname === '/research/quick') {
      if (!mayGenerateReport(req.headers)) return send(res, 401, { error: 'Research origin authorization required' })
      const body = await readJson(req)
      if (typeof body.kolHandle !== 'string' || typeof body.templateSlug !== 'string') {
        return send(res, 400, { error: 'kolHandle and templateSlug are required' })
      }
      const report = await generateQuickReport(body.kolHandle, body.templateSlug)
      let evidence: { status: string; signature: string | null } = { status: 'pending', signature: null }
      if (process.env.OPERATOR_KEYPAIR_PATH && process.env.SOLANA_RPC_URL) {
        try { evidence = await processEvidence(report.id) } catch { /* worker can retry */ }
      }
      return send(res, 201, {
        reportId: report.id,
        reportUrl: `/reports/${report.id}`,
        contentHash: report.contentHash,
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
      const report = await generateDeepReport(body.kolHandle, body.prompt)
      let evidence: { status: string; signature: string | null } = { status: 'pending', signature: null }
      if (process.env.OPERATOR_KEYPAIR_PATH && process.env.SOLANA_RPC_URL) {
        try { evidence = await processEvidence(report.id) } catch { /* worker can retry */ }
      }
      return send(res, 201, {
        reportId: report.id,
        reportUrl: '/reports/' + report.id,
        contentHash: report.contentHash,
        evidence,
        surfUsage: report.surfUsage,
      })
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
          evidenceTx: report.evidence_tx, onChainMatch, networkError,
          explorerUrl: report.evidence_tx
            ? `https://explorer.solana.com/tx/${report.evidence_tx}?cluster=devnet` : null,
        })
      }
      if (!isAdmin(req)) return send(res, 401, { error: 'Admin token required during M1' })
      if (!hashMatch) return send(res, 409, { error: 'Stored report hash mismatch' })
      return send(res, 200, {
        id: report.id, kolHandle: report.kol_ref, templateSlug: report.template_slug,
        content, contentHash: report.content_hash, evidenceTx: report.evidence_tx,
        contextAsOf: report.context_as_of, createdAt: report.created_at,
        surfModel: report.surf_model, surfUsage: report.surf_usage,
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
    const status = /Invalid X handle|Expected |too large|Unknown or disabled template|Unexpected token|Prompt must|Trading recommendations/.test(message) ? 400 :
      /not configured|Radar API|DATABASE_URL/.test(message) ? 503 : 502
    // Do not echo provider bodies, keys or prompts in HTTP errors or logs.
    send(res, status, { error: status === 400 ? message : 'Research service unavailable', code: status })
  }
})

server.listen(port, host, () => {
  process.stdout.write(`Research sidecar listening on http://${host}:${port}\n`)
})
