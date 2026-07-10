/**
 * KOL avatars on Cloudflare R2 (prefix radar/avatars).
 *
 * - DOM <img>: direct R2 public URL (no crossOrigin unless CORS is configured)
 * - WebGL textures: same-origin /r2/* rewrite → R2 (TextureLoader CORS)
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

  return p
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
