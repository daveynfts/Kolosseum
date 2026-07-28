import { withBase } from './base'
import { getAdminToken } from './feedStore'

export type BannerImageSlot = 'logo' | 'art'

export type BannerImageUploadResult =
  | {
      ok: true
      url: string
      key: string
      slot: BannerImageSlot
      bytes: number
      storage: 'r2'
      contentType?: string
    }
  | { ok: false; error: string; status?: number }

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

const MAX_BYTES = 4.5 * 1024 * 1024

export function isBannerImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  return (
    ALLOWED_TYPES.has(type) ||
    type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(name)
  )
}

export async function uploadBannerImage(
  file: File,
  slot: BannerImageSlot,
  tokenOverride?: string,
): Promise<BannerImageUploadResult> {
  const token = (tokenOverride ?? getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN rồi upload lại',
    }
  }
  if (!isBannerImageFile(file)) {
    return { ok: false, error: 'Chỉ chấp nhận PNG, JPEG, WebP, GIF' }
  }
  if (file.size < 24) {
    return { ok: false, error: 'File rỗng hoặc quá nhỏ' }
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB, max 4.5MB)`,
    }
  }

  const apiUrl = `${withBase('/api/site-banner')}?slot=${encodeURIComponent(slot)}`
  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
        Accept: 'application/json',
      },
      body: file,
    })
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      url?: string
      key?: string
      error?: string
      message?: string
    }
    if (!res.ok || !j.url) {
      return {
        ok: false,
        error: j.message || j.error || res.statusText,
        status: res.status,
      }
    }
    return {
      ok: true,
      url: j.url,
      key: j.key || '',
      slot,
      bytes: file.size,
      storage: 'r2',
      contentType: file.type || undefined,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
