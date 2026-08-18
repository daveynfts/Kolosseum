import { describe, expect, it } from 'vitest'
import {
  kolShareUrl,
  normalizeKolHandle,
  parseKolHandle,
  withKolParam,
} from './kolDeepLink'
import { mapSeoPack } from './mapSeo'

describe('kol deep link', () => {
  it('parses handle from ?kol= and strips @', () => {
    expect(parseKolHandle('?kol=ThuanCapital')).toBe('ThuanCapital')
    expect(parseKolHandle('kol=@emilyyvuong')).toBe('emilyyvuong')
    expect(parseKolHandle('?q=x')).toBeNull()
    expect(parseKolHandle('?kol=not valid')).toBeNull()
    expect(parseKolHandle('?kol=../x')).toBeNull()
  })

  it('writes and clears kol without dropping other params', () => {
    expect(withKolParam('/', '?ref=x', 'Ape_1')).toBe('/?ref=x&kol=Ape_1')
    expect(withKolParam('/', '?kol=old&ref=x', null)).toBe('/?ref=x')
    expect(withKolParam('/', '?kol=old', null)).toBe('/')
  })

  it('builds a shareable origin URL', () => {
    expect(kolShareUrl('https://radar.daveynfts.com/', '@NamOK_bnb')).toBe(
      'https://radar.daveynfts.com/?kol=NamOK_bnb',
    )
    expect(kolShareUrl('https://x.test', 'bad handle')).toBeNull()
    expect(normalizeKolHandle('')).toBeNull()
  })
})

describe('mapSeoPack', () => {
  it('uses the homepage card when no KOL is selected', () => {
    const pack = mapSeoPack(null)
    expect(pack.title).toBe("Davey's Radar — VN KOL Map")
    expect(pack.canonical).toBe('https://radar.daveynfts.com/')
    expect(pack.ogImage).toContain('/og/vn-kol-map.jpg')
  })

  it('points canonical at ?kol= when a profile is open', () => {
    const pack = mapSeoPack({
      handle: 'ThuanCapital',
      displayName: 'Thuận Capital',
    })
    expect(pack.canonical).toBe(
      'https://radar.daveynfts.com/?kol=ThuanCapital',
    )
    expect(pack.ogTitle).toContain('@ThuanCapital')
    expect(pack.ogTitle).toContain('Thuận Capital')
  })
})
