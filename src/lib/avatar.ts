/**
 * KOL avatars on Cloudflare R2 (prefix radar/avatars).
 *
 * - DOM <img>: Radar's public media route in production, local /r2/* in dev
 * - WebGL textures: the same route (Radar sends CORS headers)
 * - Optional per-KOL `avatarUrl` override (admin-edited R2 link)
 *
 * Override CDN: VITE_R2_PUBLIC_URL (must not be a pub-*.r2.dev host)
 */

const RADAR_PREFIX = 'radar'
const RADAR_PUBLIC_MEDIA_BASE = 'https://radar.daveynfts.com/r2'

/** Public R2 / custom CDN base (no trailing slash). Never use pub-*.r2.dev directly. */
export function r2PublicBase(): string {
  const fromEnv =
    (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ||
    (import.meta.env.VITE_AVATAR_CDN_BASE as string | undefined) ||
    ''
  const raw = String(fromEnv).replace(/\/$/, '')
  if (raw) {
    try {
      if (!new URL(raw).hostname.toLowerCase().endsWith('.r2.dev')) return raw
    } catch {
      /* use the Radar media proxy below */
    }
  }
  // Kolosseum's Vercel app has no private R2 credentials. Radar's public
  // media route reads the same bucket and caches successful images at its edge.
  return import.meta.env.PROD ? RADAR_PUBLIC_MEDIA_BASE : ''
}

/**
 * Object key relative to bucket (no leading slash).
 * R2 keys are case-sensitive — filenames match warm/upload handle casing
 * (often X-style: Lecter_XFinance.jpg, Martin_bml.jpg).
 */
export function avatarObjectKey(handle: string): string {
  const clean = handle.replace(/^@/, '').trim()
  const safe = clean.replace(/[?#%\\]/g, '')
  return `${RADAR_PREFIX}/avatars/${safe}.jpg`
}

/**
 * Handle casing variants for R2 lookup.
 * Reports/import often store lowercase; warm scripts keep X casing.
 */
export function avatarHandleVariants(handle: string): string[] {
  const clean = handle.replace(/^@/, '').trim().replace(/[?#%\\/]/g, '')
  if (!clean) return []
  const lower = clean.toLowerCase()
  const out = new Set<string>()
  out.add(clean)
  out.add(lower)
  // Martin_bml style: first letter upper, rest unchanged lower
  out.add(lower.charAt(0).toUpperCase() + lower.slice(1))
  // Lecter_Xfinance style: capitalize after start/_ 
  out.add(
    lower.replace(/(^|_)([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase()),
  )
  // Camel after underscore: xfinance → Xfinance (still may miss XFinance)
  // Prefer map-handle / liveFallback for exotic mixed case.
  return [...out]
}

/** Direct public media route in production, local /r2 proxy in development. */
export function xAvatarUrl(handle: string): string {
  const key = avatarObjectKey(handle)
  const base = r2PublicBase()
  return base ? `${base}/${key}` : `/r2/${key}`
}

/** Ordered R2 candidates across casing variants; avoid the unconfigured Vercel proxy. */
export function xAvatarUrlCandidates(handle: string): string[] {
  const base = r2PublicBase()
  const urls: string[] = []
  for (const h of avatarHandleVariants(handle)) {
    const key = avatarObjectKey(h)
    if (base) urls.push(`${base}/${key}`)
    if (!base || base !== RADAR_PUBLIC_MEDIA_BASE) urls.push(`/r2/${key}`)
  }
  return [...new Set(urls)]
}

/** Public image path shared by WebGL TextureLoader and DOM fallbacks. */
export function xAvatarTextureUrl(handle: string): string {
  return xAvatarUrl(handle)
}

/**
 * Prefer map/sheet handle casing when available (case-insensitive match).
 * Fixes reports that stored lowercase handles while R2 avatars keep X casing.
 */
export function resolveAvatarHandle(
  handle: string,
  kols?: Array<{ handle: string }>,
): string {
  const clean = handle.replace(/^@/, '').trim()
  if (!clean || !kols?.length) return clean
  const lower = clean.toLowerCase()
  const hit = kols.find((k) => k.handle.replace(/^@/, '').toLowerCase() === lower)
  return hit ? hit.handle.replace(/^@/, '').trim() : clean
}

/**
 * Normalize admin/manual avatar field: trim; empty → undefined.
 * Accepts full https URL, /r2/…, /radar/…, /avatars/….
 */
export function normalizeAvatarUrl(raw: string | undefined | null): string | undefined {
  const t = (raw || '').trim()
  return t || undefined
}

/**
 * Prefer per-KOL override, else default public R2 path for handle.
 */
export function resolveKolAvatarUrl(kol: {
  handle: string
  avatarUrl?: string
}): string {
  const override = normalizeAvatarUrl(kol.avatarUrl)
  if (override) return resolveMediaUrl(override)
  return xAvatarUrl(kol.handle)
}

/**
 * URL safe for WebGL TextureLoader (Radar's public route allows CORS).
 */
export function resolveKolAvatarTextureUrl(kol: {
  handle: string
  avatarUrl?: string
}): string {
  const override = normalizeAvatarUrl(kol.avatarUrl)
  if (override) return toTextureSafeUrl(override, kol.handle)
  return xAvatarTextureUrl(kol.handle)
}

/**
 * Rewrite known R2 / radar paths to the configured public media route.
 * Absolute third-party URLs are left as-is (need CORS on that host).
 */
export function toTextureSafeUrl(pathOrUrl: string, fallbackHandle?: string): string {
  const raw = (pathOrUrl || '').trim()
  if (!raw) {
    return fallbackHandle ? xAvatarTextureUrl(fallbackHandle) : ''
  }

  if (raw.startsWith('/r2/')) return resolveMediaUrl(raw)

  // /radar/avatars/foo.jpg → /r2/radar/avatars/foo.jpg
  if (raw.startsWith('/radar/')) return resolveMediaUrl(raw)

  // /avatars/handle.jpg → /r2/radar/avatars/handle.jpg
  const localAv = raw.match(/^\/avatars\/([^/?#]+)$/i)
  if (localAv) {
    let name = decodeURIComponent(localAv[1]).replace(/\.(jpe?g|png|webp)$/i, '')
    return xAvatarTextureUrl(name)
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      if (u.hostname.toLowerCase().endsWith('.r2.dev')) {
        const key = u.pathname.replace(/^\/+/, '')
        const base = r2PublicBase()
        return base ? `${base}/${key}${u.search}` : `/r2/${key}${u.search}`
      }
      const base = r2PublicBase()
      if (base && raw.startsWith(base + '/')) {
        return raw
      }
      const m = u.pathname.match(/\/(radar\/avatars\/[^/?#]+)$/i)
      if (m) return base ? `${base}/${m[1]}${u.search}` : `/r2/${m[1]}${u.search}`
    } catch {
      /* keep absolute */
    }
    return raw
  }

  return resolveMediaUrl(raw)
}

/**
 * Resolve a media path: absolute URLs kept; /avatars/* → R2 CDN.
 */
export function resolveMediaUrl(path: string): string {
  if (!path) return path
  if (/^(data:|blob:)/i.test(path)) return path
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path)
      if (u.hostname.toLowerCase().endsWith('.r2.dev')) {
        const key = u.pathname.replace(/^\/+/, '')
        const base = r2PublicBase()
        return base ? `${base}/${key}${u.search}` : `/r2/${key}${u.search}`
      }
    } catch {
      /* keep */
    }
    return path
  }

  const p = path.startsWith('/') ? path : `/${path}`
  const m = p.match(/^\/avatars\/([^/?#]+)$/i)
  if (m) {
    let name = decodeURIComponent(m[1])
    if (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')) {
      name = name.replace(/\.(jpe?g)$/i, '')
    }
    return xAvatarUrl(name)
  }

  if (p.startsWith('/radar/')) {
    const base = r2PublicBase()
    return base ? `${base}${p}` : `/r2${p}`
  }

  if (p.startsWith('/r2/')) {
    const base = r2PublicBase()
    return base ? `${base}${p.slice(3)}` : p
  }

  return p
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
