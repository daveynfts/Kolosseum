import { describe, expect, it } from 'vitest'
import { readArenaSelection } from './arenaNavigation'
describe('arena URLs', () => {
  it('restores canonical KOL and SurfAI selection', () => {
    expect(readArenaSelection('?kol=%40Luong4101992&tab=surfai')).toEqual({ handle: 'luong4101992', tab: 'surfai' })
  })
  it('rejects invalid handles and defaults unknown tabs', () => {
    expect(readArenaSelection('?kol=%3Cscript%3E&tab=secret')).toEqual({ handle: null, tab: 'overview' })
  })
})
