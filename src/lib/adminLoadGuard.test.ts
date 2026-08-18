import { describe, expect, it } from 'vitest'
import {
  datasetForAdminTab,
  parseAdminTabFromHash,
} from './adminLoadGuard'

describe('parseAdminTabFromHash', () => {
  it('uses the last path segment, not includes()', () => {
    expect(parseAdminTabFromHash('#/admin/data')).toBe('data')
    expect(parseAdminTabFromHash('#/admin/feed')).toBe('feed')
    expect(parseAdminTabFromHash('#/admin')).toBe('list')
    expect(parseAdminTabFromHash('#/admin/edit')).toBe('edit')
  })

  it('reads ?tab= and aliases', () => {
    expect(parseAdminTabFromHash('#/admin?tab=feed')).toBe('feed')
    expect(parseAdminTabFromHash('#/admin/followers')).toBe('follows')
    expect(parseAdminTabFromHash('#/admin/kol-reports')).toBe('reports')
    expect(parseAdminTabFromHash('#/admin/ops')).toBe('ops')
    expect(parseAdminTabFromHash('#/admin/health')).toBe('ops')
  })
})

describe('datasetForAdminTab', () => {
  it('maps list+edit to the same KOL dataset', () => {
    expect(datasetForAdminTab('list')).toBe('kols')
    expect(datasetForAdminTab('edit')).toBe('kols')
    expect(datasetForAdminTab('legend')).toBe(null)
    expect(datasetForAdminTab('ops')).toBe(null)
    expect(datasetForAdminTab('data')).toBe('twitterscore')
  })
})
