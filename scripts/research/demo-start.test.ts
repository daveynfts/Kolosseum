import { describe, expect, it } from 'vitest'
import { validateDemoConfig } from './demo-start'

const ready = {
  SURF_API_KEY: 'test',
  DATABASE_URL: 'postgresql://test.invalid/kolosseum_demo',
  ADMIN_TOKEN: 'test-admin-token',
  PAY_ORIGIN_TOKEN: 'x'.repeat(32),
  PAY_GATEWAY_SIGNER_WALLET: 'test-public-wallet',
  OPERATOR_KEYPAIR_PATH: 'test-keypair.json',
  SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  REPORT_ENC_KEY: 'a'.repeat(64),
  DEEP_RESEARCH_ENABLED: 'true',
  PAY_GATEWAY_ENABLED: 'true',
  PAY_DEMO_BUY_ENABLED: 'true',
  PAY_MODE: 'sandbox',
  PAY_GATEWAY_URL: 'http://127.0.0.1:1402',
}

describe('one-command sandbox demo preflight', () => {
  it('requires an explicit local sandbox and payment opt-in', () => {
    expect(validateDemoConfig(ready)).toEqual([])
    const errors = validateDemoConfig({ ...ready, PAY_MODE: 'mainnet', PAY_DEMO_BUY_ENABLED: 'false' })
    expect(errors).toContain('PAY_MODE=sandbox is required')
    expect(errors).toContain('PAY_DEMO_BUY_ENABLED=true is required for the UI demo')
  })

  it('rejects a remote gateway or an invalid encryption key before startup', () => {
    const errors = validateDemoConfig({ ...ready, PAY_GATEWAY_URL: 'https://example.com', REPORT_ENC_KEY: 'bad' })
    expect(errors).toContain('PAY_GATEWAY_URL must be local HTTP port 1402')
    expect(errors).toContain('REPORT_ENC_KEY must be 32 bytes of hex')
  })
})
