import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { parseBuyerWallet } from '../../lib/payments/walletAccess'

const execFileAsync = promisify(execFile)
const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SUCCESS_PREFIX = 'DEMO_RESULT_JSON:'

export type DemoBuyerInput = {
  kolHandle: string
  templateSlug?: string
  prompt?: string
}

export type DemoBuyerResult = {
  reportId: string
  buyerWallet: string
  protocol: 'mpp-session' | 'x402-upto'
  priceChargedUsdc: string
  explorerUrl: string
}

export class IncompleteDemoPurchaseError extends Error {
  constructor(readonly reportId: string) {
    super('Sandbox purchase may have started but did not complete verification')
  }
}

export function parseDemoBuyerResult(output: string): DemoBuyerResult {
  const line = output.split(/\r?\n/).findLast((part) => part.startsWith(SUCCESS_PREFIX))
  if (!line || line.length > 4_096) throw new Error('Demo buyer did not return a verified result')
  const parsed = JSON.parse(line.slice(SUCCESS_PREFIX.length)) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object' ||
      typeof parsed.reportId !== 'string' || !REPORT_ID.test(parsed.reportId) ||
      typeof parsed.buyerWallet !== 'string' ||
      (parsed.protocol !== 'mpp-session' && parsed.protocol !== 'x402-upto') ||
      typeof parsed.priceChargedUsdc !== 'string' ||
      !/^(0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(parsed.priceChargedUsdc) ||
      Number(parsed.priceChargedUsdc) <= 0 || Number(parsed.priceChargedUsdc) > 1 ||
      typeof parsed.explorerUrl !== 'string') {
    throw new Error('Demo buyer returned invalid verification data')
  }
  parseBuyerWallet(parsed.buyerWallet)
  const explorer = new URL(parsed.explorerUrl)
  if (explorer.origin !== 'https://explorer.solana.com' ||
      !/^\/tx\/[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(explorer.pathname) ||
      explorer.searchParams.get('cluster') !== 'devnet') {
    throw new Error('Demo buyer returned an invalid devnet link')
  }
  return parsed as DemoBuyerResult
}

export function purchasedReportId(output: string): string | null {
  const id = /Purchased report ([0-9a-f-]{36}) for @/i.exec(output)?.[1]
  return id && REPORT_ID.test(id) ? id : null
}

export async function runDemoBuyer(input: DemoBuyerInput): Promise<DemoBuyerResult> {
  if (process.platform !== 'win32') throw new Error('Local demo buyer requires Windows PowerShell')
  const script = resolve(process.cwd(), 'scripts/research/demo-buyer.ps1')
  const args = ['-NoProfile', '-File', script, '-KolHandle', input.kolHandle]
  if (input.prompt !== undefined) args.push('-Prompt', input.prompt)
  else args.push('-TemplateSlug', input.templateSlug || 'risk-profile')
  let output = ''
  try {
    const { stdout } = await execFileAsync('pwsh', args, {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 64 * 1024,
    })
    output = stdout
    return parseDemoBuyerResult(output)
  } catch (cause) {
    const stdout = (cause as { stdout?: unknown }).stdout
    const reportId = purchasedReportId(output || (typeof stdout === 'string' ? stdout : ''))
    if (reportId) throw new IncompleteDemoPurchaseError(reportId)
    throw new Error('Sandbox demo buyer failed before a verified report was returned')
  }
}
