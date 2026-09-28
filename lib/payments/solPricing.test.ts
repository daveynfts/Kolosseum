import { describe, expect, it } from 'vitest'
import { priceInLamports, validateSolRate } from './solPricing'
describe('credit priced SOL quotes', () => {
  it('converts credits using integer arithmetic and rounds up to a lamport', () => {
    expect(priceInLamports(200, 150_000_000)).toBe('8000000')
    expect(priceInLamports(20, 133_333_333)).toBe('900001')
  })
  it('rejects missing, stale, future and invalid oracle data', () => {
    const now = 1_800_000_000_000
    for (const data of [{}, { solana: { usd: 0, last_updated_at: now / 1000 } }, { solana: { usd: 150, last_updated_at: now / 1000 - 181 } }, { solana: { usd: 150, last_updated_at: now / 1000 + 31 } }]) expect(() => validateSolRate(data, now)).toThrow()
    expect(validateSolRate({ solana: { usd: 150.12, last_updated_at: now / 1000 } }, now).usdMicros).toBe(150_120_000)
    for (const credits of [-1, 0, 201, 1.5, NaN]) expect(() => priceInLamports(credits, 150_000_000)).toThrow()
  })
})
