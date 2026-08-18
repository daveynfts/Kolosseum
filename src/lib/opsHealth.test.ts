import { describe, expect, it } from 'vitest'
import {
  ageDays,
  formatAgeDays,
  opsHealthTone,
  pickIsoTimestamp,
} from './opsHealth'

describe('pickIsoTimestamp', () => {
  it('prefers the first valid field', () => {
    expect(
      pickIsoTimestamp(
        { generatedAt: '2026-08-17T04:30:22.781Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ['generatedAt', 'updatedAt'],
      ),
    ).toBe('2026-08-17T04:30:22.781Z')
  })

  it('skips empty and invalid values', () => {
    expect(
      pickIsoTimestamp({ updatedAt: '', asOf: 'not-a-date' }, ['updatedAt', 'asOf']),
    ).toBeNull()
    expect(pickIsoTimestamp(null, ['updatedAt'])).toBeNull()
  })
})

describe('opsHealthTone', () => {
  it('ok / warn / stale / error', () => {
    expect(opsHealthTone(0.5, 2, 3)).toBe('ok')
    expect(opsHealthTone(2, 2, 3)).toBe('warn')
    expect(opsHealthTone(3, 2, 3)).toBe('stale')
    expect(opsHealthTone(null, 2, 3)).toBe('error')
  })
})

describe('ageDays', () => {
  it('computes whole days from a fixed now', () => {
    const now = Date.parse('2026-08-18T00:00:00.000Z')
    expect(ageDays('2026-08-17T00:00:00.000Z', now)).toBe(1)
    expect(formatAgeDays(0.2)).toBe('5h')
    expect(formatAgeDays(2.4)).toBe('2.4d')
  })
})
