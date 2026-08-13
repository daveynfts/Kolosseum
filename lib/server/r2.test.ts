// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isPublicMediaKey } from './r2.js'

describe('isPublicMediaKey', () => {
  it('allows listed media prefixes', () => {
    expect(isPublicMediaKey('radar/avatars/a.jpg')).toBe(true)
    expect(isPublicMediaKey('media/abc123')).toBe(true)
    expect(isPublicMediaKey('scex-banner/scex-logo.png')).toBe(true)
    expect(isPublicMediaKey('kol-reports/images/r1/cover.png')).toBe(true)
    expect(isPublicMediaKey('RadarKOLsReport/HuyLe.pdf')).toBe(true)
  })

  it('blocks JSON, internal keys, traversal, and unknown prefixes', () => {
    expect(isPublicMediaKey('internal/kol-reports/v1.json')).toBe(false)
    expect(isPublicMediaKey('feed/v1.json')).toBe(false)
    expect(isPublicMediaKey('radar/secret.json')).toBe(false)
    expect(isPublicMediaKey('../radar/avatars/a.jpg')).toBe(false)
    expect(isPublicMediaKey('scex/tracking/v1.json')).toBe(false)
    expect(isPublicMediaKey('')).toBe(false)
  })
})
