import { describe, expect, it } from 'vitest'
import { computeQuadrant } from './scexTracking'

describe('computeQuadrant', () => {
  const vSplit = 50
  const qSplit = 50

  it('maps high volume + high quality to stars', () => {
    expect(computeQuadrant(60, 60, vSplit, qSplit)).toBe('stars')
  })

  it('maps low volume + high quality to nurture', () => {
    expect(computeQuadrant(40, 60, vSplit, qSplit)).toBe('nurture')
  })

  it('maps high volume + low quality to noise', () => {
    expect(computeQuadrant(60, 40, vSplit, qSplit)).toBe('noise')
  })

  it('maps low volume + low quality to ignore', () => {
    expect(computeQuadrant(40, 40, vSplit, qSplit)).toBe('ignore')
  })
})
