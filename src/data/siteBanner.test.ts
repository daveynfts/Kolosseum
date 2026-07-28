// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  normalizeSiteBanner,
  SITE_BANNER_SEED,
} from '../data/siteBanner'

describe('siteBanner', () => {
  it('normalizeSiteBanner fills defaults', () => {
    const c = normalizeSiteBanner({ title: 'Event', href: 'https://x.com' })
    expect(c.title).toBe('Event')
    expect(c.href).toBe('https://x.com')
    expect(c.enabled).toBe(true)
    expect(c.eyebrow).toBe(SITE_BANNER_SEED.eyebrow)
  })

  it('normalizeSiteBanner respects enabled=false', () => {
    const c = normalizeSiteBanner({ enabled: false, title: 'X', href: 'https://a' })
    expect(c.enabled).toBe(false)
  })
})
