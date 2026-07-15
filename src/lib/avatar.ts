/**
 * KOL avatars on Cloudflare R2 (prefix radar/avatars).
 *
 * - DOM <img>: direct R2 public URL (no crossOrigin unless CORS is configured)
 * - WebGL textures: same-origin /r2/* rewrite → R2 (TextureLoader CORS)
 * - Optional per-KOL `avatarUrl` override (admin-edited R2 link)
 *
 * Override CDN: VITE_R2_PUBLIC_URL
 */

const DEFAULT_R2_PUBLIC =
  'https://pub-8288264395e64bebab09946b5bc0b740.r2.dev'

const RADAR_PREFIX = 'radar'

/** Public R2 base (no trailing slash). */
export function r2PublicBase(): string {
  const fromEnv =
    (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ||
    (import.meta.env.VITE_AVATAR_CDN_BASE as string | undefined) ||
    DEFAULT_R2_PUBLIC
  return String(fromEnv).replace(/\/$/, '')
}

/**
 * Object key relative to bucket (no leading slash).
 * Filenames match upload from public/avatars/{handle}.jpg exactly.
 */
export function avatarObjectKey(handle: string): string {
  const clean = handle.replace(/^@/, '').trim()
  const safe = clean.replace(/[?#%\\]/g, '')
  return `${RADAR_PREFIX}/avatars/${safe}.jpg`
}

/** Direct R2 URL — best for <img> display. */
export function xAvatarUrl(handle: string): string {
  return `${r2PublicBase()}/${avatarObjectKey(handle)}`
}

/**
 * Same-origin path proxied to R2 (vercel.json rewrite).
 * WebGL TextureLoader + DOM fallback.
 */
export function xAvatarTextureUrl(handle: string): string {
  return `/r2/${avatarObjectKey(handle)}`
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
 * URL safe for WebGL TextureLoader (prefer same-origin /r2 when possible).
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
 * Rewrite known R2 / radar paths to same-origin /r2/* for TextureLoader CORS.
 * Absolute third-party URLs left as-is (need CORS on that host).
 */
export function toTextureSafeUrl(pathOrUrl: string, fallbackHandle?: string): string {
  const raw = (pathOrUrl || '').trim()
  if (!raw) {
    return fallbackHandle ? xAvatarTextureUrl(fallbackHandle) : ''
  }

  // Already same-origin proxy
  if (raw.startsWith('/r2/')) return raw

  // /radar/avatars/foo.jpg → /r2/radar/avatars/foo.jpg
  if (raw.startsWith('/radar/')) return `/r2${raw}`

  // /avatars/handle.jpg → /r2/radar/avatars/handle.jpg
  const localAv = raw.match(/^\/avatars\/([^/?#]+)$/i)
  if (localAv) {
    let name = decodeURIComponent(localAv[1]).replace(/\.(jpe?g|png|webp)$/i, '')
    return xAvatarTextureUrl(name)
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      const base = r2PublicBase()
      // Our public R2 or custom CDN base → same-origin rewrite
      if (base && raw.startsWith(base + '/')) {
        const key = raw.slice(base.length + 1)
        return `/r2/${key}`
      }
      // Any …/radar/avatars/… path on R2-like host
      const m = u.pathname.match(/\/(radar\/avatars\/[^/?#]+)$/i)
      if (m) return `/r2/${m[1]}`
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
  if (/^(https?:|data:|blob:)/i.test(path)) return path

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
    return `${r2PublicBase()}${p}`
  }

  if (p.startsWith('/r2/')) {
    return `${r2PublicBase()}${p.slice(3)}`
  }

  return p
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
