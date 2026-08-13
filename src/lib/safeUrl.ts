/**
 * Shared URL allowlists for href / CSS / markdown.
 * Keep this the single gate so new UI surfaces cannot skip protocol checks.
 */

function trimmed(url: string | undefined | null): string {
  return (url || '').trim()
}

/** Same-origin path, not protocol-relative (`//evil`). */
export function isSafeRelativePath(url: string): boolean {
  const u = trimmed(url)
  return u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/\\')
}

/** http(s) or a same-origin path — never javascript:/data:/vbscript: */
export function isSafeHttpUrl(url: string | undefined | null): boolean {
  const u = trimmed(url)
  if (!u) return false
  if (isSafeRelativePath(u)) return true
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/** Images: http(s), relative path, or data:image/* */
export function isSafeImageUrl(url: string | undefined | null): boolean {
  const u = trimmed(url)
  if (!u) return false
  if (u.startsWith('data:image/')) return true
  return isSafeHttpUrl(u)
}

export function safeHref(url: string | undefined | null): string | undefined {
  const u = trimmed(url)
  return isSafeHttpUrl(u) ? u : undefined
}

/** Reject CSS url() breakouts (quotes / parens / backslash). */
export function cssSafeUrl(url: string | undefined | null): string | undefined {
  const u = trimmed(url)
  if (!isSafeImageUrl(u)) return undefined
  if (/['"\\)]/.test(u)) return undefined
  return u
}

/** @deprecated alias — use isSafeImageUrl */
export const isSafeUrl = isSafeImageUrl
