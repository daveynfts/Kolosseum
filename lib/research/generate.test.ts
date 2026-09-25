import { describe, expect, it } from 'vitest'
import { groundSamplePostCount, normalizeDeepPrompt } from './generate'

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

describe('report grounding', () => {
  it('corrects only the supplied sample count and leaves the full KOL post volume intact', () => {
    const report = 'The supplied record contains **21 SCEX-related posts**. The KOL has 36 SCEX posts in the full snapshot.'
    expect(groundSamplePostCount(report, 20))
      .toBe('The supplied record contains **20 SCEX-related posts**. The KOL has 36 SCEX posts in the full snapshot.')
  })
})