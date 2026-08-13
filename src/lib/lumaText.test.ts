import { describe, expect, it } from 'vitest'
import {
  looksLikeLumaThemeFont,
  sanitizeLumaText,
  stripLumaFontStyles,
} from './lumaText'
import { normalizeSideEvent } from '../data/convictionEvents'

describe('lumaText', () => {
  it('keeps valid Vietnamese unicode (not mojibake)', () => {
    expect(sanitizeLumaText('Pudgy Việt Nam x Renaiss Việt Nam')).toBe(
      'Pudgy Việt Nam x Renaiss Việt Nam',
    )
    expect(sanitizeLumaText('10 Đường Mai Chí Thọ, Thủ Đức')).toBe(
      '10 Đường Mai Chí Thọ, Thủ Đức',
    )
  })

  it('strips Luma decorative font-family from HTML', () => {
    const html =
      '<h1 style="font-family:snpro, new-spirit, sans-serif">Chào Việt Nam</h1>'
    expect(stripLumaFontStyles(html)).not.toMatch(/font-family/i)
    expect(sanitizeLumaText(html)).toBe('Chào Việt Nam')
  })

  it('strips --title-font / geist-mono / museo theme CSS', () => {
    const html =
      '<p style="--title-font:geist-mono;font-family:museo-slab">Đăng ký Luma</p>'
    expect(sanitizeLumaText(html)).toBe('Đăng ký Luma')
    expect(looksLikeLumaThemeFont('snpro')).toBe(true)
    expect(looksLikeLumaThemeFont('Be Vietnam Pro')).toBe(false)
  })

  it('normalizeSideEvent ignores Luma theme fonts and sanitizes copy', () => {
    const ev = normalizeSideEvent({
      id: 'luma-html',
      title: '<span style="font-family:roc-grotesk">Mixer bên lề</span>',
      host: '<b style="font-family:snpro">Nghiên AI</b>',
      venue: 'Thiskyhall Sala',
      address: '10 Đường Mai Chí Thọ, An Khánh, Thủ Đức',
      description:
        '<div style="font-family:new-spirit">Check-in từ 08:30 tại Thiskyhall.</div>',
      lat: 10.77,
      lng: 106.72,
      date: '2026-08-15',
      startTime: '09:00',
      type: 'meetup',
      font_title: 'snpro',
      theme_meta: { theme: 'legacy' },
    })
    expect(ev).not.toBeNull()
    expect(ev!.title).toBe('Mixer bên lề')
    expect(ev!.host).toBe('Nghiên AI')
    expect(ev!.description).toBe('Check-in từ 08:30 tại Thiskyhall.')
    expect(ev!.address).toContain('Đường')
    expect(JSON.stringify(ev)).not.toMatch(/snpro|font_title|roc-grotesk/)
  })
})
