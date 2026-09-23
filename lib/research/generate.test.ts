import { describe, expect, it } from 'vitest'
import { normalizeDeepPrompt } from './generate'

describe('custom research prompt policy', () => {
  it('accepts an evidence-focused research angle', () => {
    expect(normalizeDeepPrompt('  Analyze this KOL’s credibility using linked posts.  '))
      .toBe('Analyze this KOL’s credibility using linked posts.')
  })

  it('rejects direct trading advice requests and prompts outside the size limit', () => {
    expect(() => normalizeDeepPrompt('Should I buy SOL now?')).toThrow('Trading recommendations')
    expect(() => normalizeDeepPrompt('short')).toThrow('20 to 2000')
    expect(() => normalizeDeepPrompt('x'.repeat(2001))).toThrow('20 to 2000')
  })
})
