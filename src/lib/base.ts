/**
 * Public base path for deploy under daveynfts.com/vietnamkolradar/
 * Vite injects import.meta.env.BASE_URL (always ends with /).
 */
export function appBase(): string {
  const b = import.meta.env.BASE_URL || '/'
  return b.endsWith('/') ? b : `${b}/`
}

/** Prefix site paths with base. Leaves absolute http(s)/data/blob URLs alone. */
export function withBase(path: string): string {
  if (!path) return path
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const base = appBase()
  if (base === '/') {
    return path.startsWith('/') ? path : `/${path}`
  }
  const baseNoSlash = base.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (p === baseNoSlash || p.startsWith(`${baseNoSlash}/`)) return p
  return `${baseNoSlash}${p}`
}
