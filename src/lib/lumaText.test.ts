import { describe, expect, it } from 'vitest'
import {
  looksLikeCp437Mojibake,
  looksLikeLumaThemeFont,
  repairCp437Utf8Mojibake,
  sanitizeLumaText,
  stripLumaFontStyles,
} from './lumaText'
import { normalizeSideEvent, CONVICTION_EVENTS_SEED } from '../data/convictionEvents'

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

  it('repairs CP437 mojibake from live R2 (OnlyDevs / ×)', () => {
    expect(
      sanitizeLumaText('22B Nguyß╗àn Thß╗ï Diß╗çu'),
    ).toBe('22B Nguyễn Thị Diệu')
    expect(
      sanitizeLumaText(
        'Meetup developer: Solana, smart accounts, security, infrastructure, AI ├ù Crypto. GitHub + approval.',
      ),
    ).toBe(
      'Meetup developer: Solana, smart accounts, security, infrastructure, AI × Crypto. GitHub + approval.',
    )
    expect(sanitizeLumaText('Conviction 2026 ΓÇö Side Events Map')).toBe(
      'Conviction 2026 — Side Events Map',
    )
    expect(
      sanitizeLumaText(
        '10 ─É╞░ß╗¥ng Mai Ch├¡ Thß╗ì, An Kh├ính, Thß╗º ─Éß╗⌐c, Th├ánh phß╗æ Hß╗ô Ch├¡ Minh 71110, Vietnam',
      ),
    ).toBe(
      '10 Đường Mai Chí Thọ, An Khánh, Thủ Đức, Thành phố Hồ Chí Minh 71110, Vietnam',
    )
    expect(looksLikeCp437Mojibake('22B Nguyß╗àn')).toBe(true)
    expect(looksLikeCp437Mojibake('22B Nguyễn Thị Diệu')).toBe(false)
  })

  it('does not mangle already-correct Vietnamese or middle dots', () => {
    const pudgy = 'Pudgy Việt Nam x Renaiss Việt Nam TCG Coffee Meet Up'
    expect(repairCp437Utf8Mojibake(pudgy)).toBe(pudgy)
    const starbucks =
      'Starbucks · Thiso Mall / SALA Shopping Mall, 10 Mai Chí Thọ, An Khánh, Thủ Đức, TP.HCM'
    expect(sanitizeLumaText(starbucks)).toBe(starbucks)
  })

  it('repairs latin-1 UTF-8 mojibake of Vietnamese', () => {
    const mangled = `Nguy${String.fromCharCode(0xe1, 0xbb, 0x85)}n`
    expect(sanitizeLumaText(mangled)).toBe('Nguyễn')
  })

  it('normalizeSideEvent repairs mojibake venue/description from R2', () => {
    const ev = normalizeSideEvent({
      id: 'onlydevs-vietnam',
      title: 'OnlyDevs Vietnam',
      host: 'OnlyDevs',
      venue: '22B Nguyß╗àn Thß╗ï Diß╗çu',
      address: '22B Nguyß╗àn Thß╗ï Diß╗çu, Quß║¡n 3, TP. Hß╗ô Ch├¡ Minh',
      description:
        'Meetup developer: Solana, smart accounts, security, infrastructure, AI ├ù Crypto. GitHub + approval.',
      lat: 10.77686,
      lng: 106.68953,
      date: '2026-08-14',
      startTime: '09:30',
      type: 'meetup',
    })
    expect(ev).not.toBeNull()
    expect(ev!.venue).toBe('22B Nguyễn Thị Diệu')
    expect(ev!.address).toBe('22B Nguyễn Thị Diệu, Quận 3, TP. Hồ Chí Minh')
    expect(ev!.description).toContain('AI × Crypto')
    expect(ev!.venue + ev!.address + ev!.description).not.toMatch(
      /[\u2500-\u259F]|ß╗|├ù|ΓÇ/,
    )
  })

  it('seed OnlyDevs copy matches Luma (Nguyễn Thị Diệu / Xuân Hòa)', () => {
    const ev = CONVICTION_EVENTS_SEED.events.find((e) => e.id === 'onlydevs-vietnam')
    expect(ev).toBeTruthy()
    expect(ev!.venue).toBe('22B Nguyễn Thị Diệu')
    expect(ev!.address).toBe(
      '22B Nguyễn Thị Diệu, Xuân Hòa, Hồ Chí Minh, Vietnam',
    )
    expect(ev!.description).toContain('AI × Crypto')
    expect(JSON.stringify(CONVICTION_EVENTS_SEED)).not.toMatch(
      /[\u2500-\u259F]|ß╗|├ù|ΓÇö/,
    )
  })
})
