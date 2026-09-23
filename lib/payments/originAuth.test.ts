import { describe, expect, it } from 'vitest'
import { mayGenerateReport } from './originAuth'

const admin = 'a'.repeat(40)
const origin = 'b'.repeat(40)

describe('research origin authentication', () => {
  it('rejects direct admin calls when sandbox gateway mode is enabled', () => {
    const env = { ADMIN_TOKEN: admin, PAY_GATEWAY_ENABLED: 'true', PAY_MODE: 'sandbox', PAY_ORIGIN_TOKEN: origin }
    expect(mayGenerateReport({ authorization: 'Bearer ' + admin }, env)).toBe(false)
    expect(mayGenerateReport({ 'x-kolosseum-gateway': 'wrong' }, env)).toBe(false)
    expect(mayGenerateReport({ 'x-kolosseum-gateway': origin }, env)).toBe(true)
  })

  it('retains the private M1 admin path while the gateway is disabled', () => {
    const env = { ADMIN_TOKEN: admin, PAY_GATEWAY_ENABLED: 'false', PAY_MODE: 'sandbox', PAY_ORIGIN_TOKEN: origin }
    expect(mayGenerateReport({ authorization: 'Bearer ' + admin }, env)).toBe(true)
    expect(mayGenerateReport({ 'x-kolosseum-gateway': origin }, env)).toBe(false)
  })

  it('never enables report generation in mainnet mode', () => {
    const env = { ADMIN_TOKEN: admin, PAY_GATEWAY_ENABLED: 'true', PAY_MODE: 'mainnet', PAY_ORIGIN_TOKEN: origin }
    expect(mayGenerateReport({ 'x-kolosseum-gateway': origin }, env)).toBe(false)
  })
})
