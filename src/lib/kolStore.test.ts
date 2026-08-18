import { describe, expect, it } from 'vitest'
import { mergeKolsPreserveServerExtras } from './kolStore'
import type { Kol } from '../types'

function kol(partial: Partial<Kol> & Pick<Kol, 'id' | 'handle'>): Kol {
  return {
    displayName: partial.handle,
    niche: 'News',
    rank: 'audience',
    niches: ['News'],
    followers: 1,
    ...partial,
  } as Kol
}

describe('mergeKolsPreserveServerExtras', () => {
  it('appends server-only KOLs so hidden rows are not dropped', () => {
    const local = [kol({ id: 'a', handle: 'alice' })]
    const server = [
      kol({ id: 'a', handle: 'alice', avatarUrl: 'https://x.com/a.jpg' }),
      kol({ id: 'b', handle: 'bob', hidden: true }),
    ]
    const merged = mergeKolsPreserveServerExtras(local, server)
    expect(merged.map((k) => k.id).sort()).toEqual(['a', 'b'])
    expect(merged.find((k) => k.id === 'a')?.avatarUrl).toBe(
      'https://x.com/a.jpg',
    )
    expect(merged.find((k) => k.id === 'b')?.hidden).toBe(true)
  })
})
