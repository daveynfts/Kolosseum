/** Public map deep link: `/?kol=handle` */

const HANDLE_RE = /^[A-Za-z0-9_]{1,32}$/

export function normalizeKolHandle(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const handle = raw.trim().replace(/^@+/, '')
  if (!HANDLE_RE.test(handle)) return null
  return handle
}

export function parseKolHandle(search: string): string | null {
  const q = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(q)
  return normalizeKolHandle(params.get('kol'))
}

/** Path + query with `kol` set or removed. Keeps unrelated params. */
export function withKolParam(
  pathname: string,
  search: string,
  handle: string | null,
): string {
  const q = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(q)
  const next = handle ? normalizeKolHandle(handle) : null
  if (next) params.set('kol', next)
  else params.delete('kol')
  const qs = params.toString()
  const path = pathname || '/'
  return `${path}${qs ? `?${qs}` : ''}`
}

export function kolShareUrl(origin: string, handle: string): string | null {
  const next = normalizeKolHandle(handle)
  if (!next) return null
  const o = origin.replace(/\/+$/, '')
  return `${o}/?kol=${encodeURIComponent(next)}`
}

export function writeKolParam(handle: string | null) {
  const next = withKolParam(
    window.location.pathname,
    window.location.search,
    handle,
  )
  const cur = `${window.location.pathname}${window.location.search}`
  if (cur !== next) history.replaceState(null, '', next)
}
