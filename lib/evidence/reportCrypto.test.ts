import { describe, expect, it } from 'vitest'
import { REPORT_DISCLAIMER, decryptReport, encryptReport, hashesMatch, sanitizeResearch, sha256 } from './reportCrypto'

const key = 'a7'.repeat(32)

describe('research report integrity', () => {
  it('encrypts with a fresh nonce and detects tampering', () => {
    const report = '## Summary\n\nBằng chứng: https://x.com/a/status/1'
    const first = encryptReport(report, key)
    const second = encryptReport(report, key)
    expect(first).not.toBe(second)
    expect(decryptReport(first, key)).toBe(report)
    expect(hashesMatch(sha256(decryptReport(first, key)), sha256(report))).toBe(true)
    expect(() => decryptReport(first, 'b8'.repeat(32))).toThrow()
    expect(hashesMatch(sha256(report), sha256(`${report} changed`))).toBe(false)
  })

  it('removes direct trading advice and images and appends the fixed disclaimer', () => {
    const clean = sanitizeResearch('## Summary\nNên mua token này ngay.\n![tracker](https://bad.test/i)\nMột nguồn khác.')
    expect(clean).not.toContain('Nên mua')
    expect(clean).not.toContain('https://bad.test')
    expect(clean).toContain('Một nguồn khác.')
    expect(clean).toContain('not investment advice')
  })

  it('blocks imperative trade calls while preserving factual context', () => {
    const clean = sanitizeResearch('## Summary\nBuy SOL at $100.\nRecommendation: sell BTC.\n- Strong buy signal.\nThe linked post described a past purchase.')
    expect(clean).not.toContain('Buy SOL at $100')
    expect(clean).not.toContain('Recommendation: sell BTC')
    expect(clean).not.toContain('Strong buy signal')
    expect(clean).toContain('The linked post described a past purchase.')
    expect(clean).toContain(REPORT_DISCLAIMER)
  })

  it('removes recommendation sections and alternative imperative calls', () => {
    const clean = sanitizeResearch('## Trade setup\nWe recommend buying this token.\nSell 25% now.\nThe source post was published on 1 September.')
    expect(clean).not.toContain('Trade setup')
    expect(clean).not.toContain('recommend buying')
    expect(clean).not.toContain('Sell 25%')
    expect(clean).toContain('The source post was published on 1 September.')
  })
})
