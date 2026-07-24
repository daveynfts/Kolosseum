/**
 * Upload report images to R2 via PUT /api/kol-report-image
 * → key kol-reports/images/{filename}
 */
import { withBase } from './base'
import { getAdminToken } from './feedStore'

export type KolReportImageUploadResult =
  | {
      ok: true
      url: string
      key: string
      filename: string
      bytes: number
    }
  | { ok: false; error: string; status?: number }

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

function sanitizeName(name: string): string {
  let n = name.trim().replace(/\\/g, '/').split('/').pop() || 'image.png'
  n = n.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_').replace(/\s+/g, '_')
  if (!/\.(png|jpe?g|webp|gif)$/i.test(n)) {
    n = `${n.replace(/\.[^.]+$/, '') || 'image'}.png`
  }
  return n
}

export async function uploadKolReportImage(
  file: File,
  options?: { token?: string; filename?: string },
): Promise<KolReportImageUploadResult> {
  const token = (options?.token || getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN',
    }
  }
  if (!file || file.size < 24) {
    return { ok: false, error: 'File rỗng hoặc quá nhỏ' }
  }
  if (file.size > 4.5 * 1024 * 1024) {
    return {
      ok: false,
      error: 'Ảnh quá lớn (max ~4.5MB)',
    }
  }

  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const okType =
    ALLOWED_TYPES.has(type) ||
    /\.(png|jpe?g|webp|gif)$/i.test(name)
  if (!okType) {
    return {
      ok: false,
      error: 'Chỉ nhận PNG, JPEG, WebP, GIF',
    }
  }

  const filename = sanitizeName(options?.filename || file.name || 'image.png')
  const url = `${withBase('/api/kol-report-image')}?filename=${encodeURIComponent(filename)}`

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': type || 'image/png',
        'X-Filename': filename,
      },
      body: file,
    })
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          String(data.message || data.error || text.slice(0, 160)) ||
          `HTTP ${res.status}`,
      }
    }
    return {
      ok: true,
      url: String(data.url || ''),
      key: String(data.key || ''),
      filename: String(data.filename || filename),
      bytes: Number(data.bytes) || file.size,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Build markdown image snippet */
export function markdownImage(url: string, alt = ''): string {
  const a = (alt || 'image').replace(/[\[\]]/g, '')
  return `![${a}](${url})`
}
