// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isPublicMediaKey, isLeakyR2DevUrl, r2PublicBase } from './r2.js'

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

describe('leaky R2 public development URL', () => {
  it('flags pub-*.r2.dev hosts', () => {
    expect(
      isLeakyR2DevUrl(
        'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev',
      ),
    ).toBe(true)
    expect(isLeakyR2DevUrl('https://cdn.example.com/radar/a.jpg')).toBe(false)
  })

  it('r2PublicBase ignores .r2.dev env values', () => {
    const prevBase = process.env.R2_PUBLIC_BASE_URL
    const prevUrl = process.env.R2_PUBLIC_URL
    process.env.R2_PUBLIC_BASE_URL =
      'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev'
    delete process.env.R2_PUBLIC_URL
    expect(r2PublicBase()).toBe('')
    if (prevBase === undefined) delete process.env.R2_PUBLIC_BASE_URL
    else process.env.R2_PUBLIC_BASE_URL = prevBase
    if (prevUrl === undefined) delete process.env.R2_PUBLIC_URL
    else process.env.R2_PUBLIC_URL = prevUrl
  })
})
