import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'

type AuthEnv = {
  ADMIN_TOKEN?: string
  PAY_GATEWAY_ENABLED?: string
  PAY_MODE?: string
  PAY_ORIGIN_TOKEN?: string
}

function secretMatches(expected: string | undefined, candidate: string | undefined): boolean {
  if (!expected || expected.length < 32 || !candidate) return false
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export function mayGenerateReport(headers: IncomingHttpHeaders, env: AuthEnv = process.env): boolean {
  if (env.PAY_GATEWAY_ENABLED === 'true') {
    if (env.PAY_MODE !== 'sandbox') return false
    const candidate = headers['x-kolosseum-gateway']
    return typeof candidate === 'string' && secretMatches(env.PAY_ORIGIN_TOKEN, candidate)
  }
  const candidate = /^Bearer (.+)$/i.exec(headers.authorization || '')?.[1]
  return secretMatches(env.ADMIN_TOKEN, candidate)
}
