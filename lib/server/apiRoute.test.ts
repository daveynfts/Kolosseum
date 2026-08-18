import { describe, expect, it } from 'vitest'
import { apiRouteName, isBinRoute, isJsonRoute } from './apiRoute.js'

describe('apiRouteName', () => {
  it('prefers ?route= over the rewritten /api/json path', () => {
    expect(
      apiRouteName({ query: { route: 'feed' }, url: '/api/json?route=feed' }),
    ).toBe('feed')
  })

  it('maps legacy aliases', () => {
    expect(
      apiRouteName({
        query: { route: 'banner-image' },
        url: '/api/bin?route=banner-image',
      }),
    ).toBe('site-banner')
    expect(
      apiRouteName({
        query: { route: 'surf-report' },
        url: '/api/bin?route=surf-report',
      }),
    ).toBe('kol-report-image')
  })

  it('falls back to the last /api/ segment', () => {
    expect(apiRouteName({ query: {}, url: '/api/kols?all=1' })).toBe('kols')
  })

  it('ignores json/bin as route names', () => {
    expect(apiRouteName({ query: {}, url: '/api/json' })).toBe('')
  })
})

describe('route tables', () => {
  it('classifies json vs bin', () => {
    expect(isJsonRoute('feed')).toBe(true)
    expect(isJsonRoute('media')).toBe(false)
    expect(isBinRoute('media')).toBe(true)
    expect(isBinRoute('kols')).toBe(false)
  })
})
