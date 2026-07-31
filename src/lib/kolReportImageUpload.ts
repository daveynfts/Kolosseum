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
      overwritten?: boolean
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

function extFromContentType(ct: string): string {
  const t = (ct || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  return 'png'
}

/**
 * PUT raw bytes (File / Blob / ArrayBuffer) → R2.
 * Used by file picker and DOCX embedded image extraction.
 */
/**
 * Stable relative path for overwrite: {reportId}/{slot}.ext
 * Same path on re-upload → R2 PutObject replaces old bytes (no new file).
 */
export function stableReportImagePath(
  reportId: string,
  slot: string,
  ext: string,
): string {
  const id = String(reportId || 'report')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 64)
  const s = String(slot || 'img')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 48)
  const e = (ext || 'jpg').replace(/^\./, '').toLowerCase()
  return `${id}/${s}.${e}`
}

export async function uploadKolReportImageBytes(
  body: Blob | ArrayBuffer | Uint8Array,
  options?: {
    token?: string
    filename?: string
    handle?: string
    contentType?: string
    stem?: string
    /** When set with reportId+slot, PUT overwrites the same R2 object */
    overwrite?: boolean
    reportId?: string
    slot?: string
  },
): Promise<KolReportImageUploadResult> {
  const token = (options?.token || getAdminToken()).trim()
  if (!token) {
    return {
      ok: false,
      error: 'Chưa có token — dán FEED_ADMIN_TOKEN rồi upload lại',
    }
  }

  let blob: Blob
  const hinted = (options?.contentType || '').toLowerCase()
  if (body instanceof Blob) {
    blob = body
  } else if (body instanceof ArrayBuffer) {
    blob = new Blob([body], {
      type: hinted || 'application/octet-stream',
    })
  } else {
    const u8 = body as Uint8Array
    // copy into a plain ArrayBuffer (avoids SharedArrayBuffer typing issues)
    const ab = new ArrayBuffer(u8.byteLength)
    new Uint8Array(ab).set(u8)
    blob = new Blob([ab], {
      type: hinted || 'application/octet-stream',
    })
  }

  if (blob.size < 24) {
    return { ok: false, error: 'File rỗng hoặc quá nhỏ' }
  }
  if (blob.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Ảnh quá lớn (${(blob.size / 1024 / 1024).toFixed(1)}MB, max 4.5MB)`,
    }
  }

  // Normalize mammoth / Word content-types (image/jpg, image/pjpeg, …)
  const hintedNorm =
    hinted === 'image/jpg' || hinted === 'image/pjpeg'
      ? 'image/jpeg'
      : hinted

  const contentType =
    hintedNorm && ALLOWED_TYPES.has(hintedNorm)
      ? hintedNorm
      : blob.type && ALLOWED_TYPES.has(blob.type.toLowerCase())
        ? blob.type.toLowerCase() === 'image/jpg'
          ? 'image/jpeg'
          : blob.type
        : `image/${extFromContentType(hintedNorm || blob.type || 'image/png') === 'jpg' ? 'jpeg' : extFromContentType(hintedNorm || blob.type || 'image/png')}`

  // Server sniffs magic bytes; content-type is a hint
  const ext = extFromContentType(contentType)
  const stem = options?.stem || options?.handle || 'img'
  const overwrite = !!options?.overwrite && !!options?.reportId
  const slot = options?.slot || options?.stem || 'img'
  const filename = overwrite
    ? stableReportImagePath(options!.reportId!, slot, ext)
    : options?.filename ||
      `${String(stem)
        .replace(/[^\w.\-]+/g, '_')
        .slice(0, 60)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`

  // Avoid "/" inside query filename (%2F is mangled by some proxies).
  // Overwrite uses reportId + slot; path still sent via X-Filename.
  const apiUrl = overwrite
    ? `${withBase('/api/kol-report-image')}?overwrite=1` +
      `&reportId=${encodeURIComponent(options!.reportId!)}` +
      `&slot=${encodeURIComponent(slot)}` +
      `&ext=${encodeURIComponent(ext)}`
    : `${withBase('/api/kol-report-image')}?filename=${encodeURIComponent(filename)}`

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'X-Filename': filename,
        ...(overwrite ? { 'X-Overwrite': '1' } : {}),
      },
      body: blob,
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
      bytes: Number(data.bytes) || blob.size,
      storage: 'r2',
      contentType:
        data.contentType != null ? String(data.contentType) : contentType,
      overwritten: data.overwritten === true,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * PUT File → R2 (file picker / drag-drop / paste).
 */
export async function uploadKolReportImage(
  file: File,
  options?: {
    token?: string
    filename?: string
    handle?: string
    overwrite?: boolean
    reportId?: string
    slot?: string
  },
): Promise<KolReportImageUploadResult> {
  if (!file || file.size < 24) {
    return { ok: false, error: 'File rỗng hoặc quá nhỏ' }
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
  return uploadKolReportImageBytes(file, {
    token: options?.token,
    filename,
    handle: options?.handle,
    contentType: file.type || undefined,
    overwrite: options?.overwrite,
    reportId: options?.reportId,
    slot: options?.slot,
  })
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
