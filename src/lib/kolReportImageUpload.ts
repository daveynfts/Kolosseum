/**
 * Upload report images straight to Cloudflare R2 via PUT /api/kol-report-image
 * → object key: kol-reports/images/{unique-name}
 * → returns public CDN URL for markdown ![alt](url)
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

function sanitizeStem(name: string): string {
  let n = name.trim().replace(/\\/g, '/').split('/').pop() || 'image'
  n = n.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_').replace(/\s+/g, '_')
  n = n.replace(/\.(png|jpe?g|webp|gif)$/i, '')
  return n.slice(0, 80) || 'image'
}

function extFromFile(file: File): string {
  const t = (file.type || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  const m = (file.name || '').match(/\.(png|jpe?g|webp|gif)$/i)
  if (m) return m[1].toLowerCase().replace('jpeg', 'jpg')
  return 'jpg'
}

/** Unique client-side name (server also re-uniques) */
export function uniqueImageFilename(
  file: File,
  prefix?: string,
): string {
  const stem = sanitizeStem(
    prefix ? `${prefix}_${file.name || 'img'}` : file.name || 'img',
  )
  const ext = extFromFile(file)
  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${stem}_${stamp}.${ext}`
}

export function isImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  return (
    ALLOWED_TYPES.has(type) ||
    type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(name)
  )
}

/**
 * PUT raw image bytes → R2. Does NOT store base64 in the report JSON.
 * Markdown only receives the returned public URL.
 */
export async function uploadKolReportImage(
  file: File,
  options?: { token?: string; filename?: string; handle?: string },
): Promise<KolReportImageUploadResult> {
  const token = (options?.token || getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN rồi upload lại',
    }
  }
  if (!file || file.size < 24) {
    return { ok: false, error: 'File rỗng hoặc quá nhỏ' }
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB, max 4.5MB)`,
    }
  }

  if (!isImageFile(file)) {
    return {
      ok: false,
      error: 'Chỉ nhận PNG, JPEG, WebP, GIF — đẩy thẳng lên R2',
    }
  }

  const filename =
    options?.filename ||
    uniqueImageFilename(
      file,
      options?.handle ? `kol_${options.handle}` : undefined,
    )

  const apiUrl = `${withBase('/api/kol-report-image')}?filename=${encodeURIComponent(filename)}`
  const contentType =
    file.type && ALLOWED_TYPES.has(file.type.toLowerCase())
      ? file.type
      : `image/${extFromFile(file) === 'jpg' ? 'jpeg' : extFromFile(file)}`

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'X-Filename': filename,
      },
      // Raw File body → serverless → r2PutBytes (no base64 in report corpus)
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

    const url = String(data.url || '').trim()
    const key = String(data.key || '').trim()
    if (!url || !key) {
      return {
        ok: false,
        error: 'API không trả URL/key R2 — kiểm tra R2_PUBLIC_BASE_URL',
      }
    }
    // Guard: must look like R2 CDN or /r2/ proxy — never accept empty/local
    const looksR2 =
      key.startsWith('kol-reports/images/') &&
      (url.includes('r2.dev') ||
        url.includes('/r2/') ||
        url.startsWith('https://') ||
        url.startsWith('/r2/'))
    if (!looksR2) {
      return {
        ok: false,
        error: `URL không phải R2: ${url.slice(0, 80)}`,
      }
    }

    return {
      ok: true,
      url,
      key,
      filename: String(data.filename || filename),
      bytes: Number(data.bytes) || file.size,
      storage: 'r2',
      contentType: data.contentType != null ? String(data.contentType) : undefined,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Build markdown image snippet pointing at R2 URL */
export function markdownImage(url: string, alt = ''): string {
  const a = (alt || 'image').replace(/[\[\]]/g, '')
  return `![${a}](${url})`
}

/** File from clipboard paste / drop */
export function fileFromClipboardItem(item: DataTransferItem): File | null {
  if (item.kind !== 'file') return null
  const f = item.getAsFile()
  if (!f || !isImageFile(f)) return null
  return f
}
