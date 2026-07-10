/** X profile images — served from local cache in /public/avatars */

import { withBase } from './base'

export function xAvatarUrl(handle: string): string {
  const clean = handle.replace(/^@/, '').trim()
  return withBase(`/avatars/${encodeURIComponent(clean)}.jpg`)
}

export function xAvatarTextureUrl(handle: string): string {
  return xAvatarUrl(handle)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
