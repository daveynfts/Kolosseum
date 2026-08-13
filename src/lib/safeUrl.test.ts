import { describe, expect, it } from 'vitest'
import { cssSafeUrl, isSafeHttpUrl, isSafeImageUrl, safeHref } from './safeUrl'

describe('safeUrl', () => {
  it('allows http(s) and relative paths', () => {
    expect(isSafeHttpUrl('https://lu.ma/x')).toBe(true)
    expect(isSafeHttpUrl('http://example.com')).toBe(true)
    expect(isSafeHttpUrl('/event/conviction-2026')).toBe(true)
    expect(isSafeHttpUrl('/r2/radar/avatars/a.jpg')).toBe(true)
  })

  it('blocks javascript, data, protocol-relative', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false)
    expect(isSafeHttpUrl('//evil.example/x')).toBe(false)
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('https://x.com/a')).toBe('https://x.com/a')
  })

  it('images allow data:image but not data:text', () => {
    expect(isSafeImageUrl('data:image/png;base64,abc')).toBe(true)
    expect(isSafeImageUrl('data:text/html,x')).toBe(false)
    expect(cssSafeUrl('https://cdn.example/a.png')).toBe(
      'https://cdn.example/a.png',
    )
    expect(cssSafeUrl('https://x.com/a.png")')).toBeUndefined()
  })
})
