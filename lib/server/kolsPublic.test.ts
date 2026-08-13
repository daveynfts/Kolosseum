// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isHiddenKol, publicKolsOnly } from './kolsPublic.js'

describe('publicKolsOnly', () => {
  it('drops hidden KOLs and keeps the rest', () => {
    const list = [
      { id: 'a', hidden: false },
      { id: 'b', hidden: true },
      { id: 'c' },
    ]
    expect(publicKolsOnly(list).map((k) => k.id)).toEqual(['a', 'c'])
  })

  it('treats only explicit hidden:true as hidden', () => {
    expect(isHiddenKol({ hidden: true })).toBe(true)
    expect(isHiddenKol({ hidden: false })).toBe(false)
    expect(isHiddenKol({})).toBe(false)
    expect(isHiddenKol(null)).toBe(false)
  })
})
